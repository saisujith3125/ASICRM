import React, { useState, useEffect } from 'react';
import {
  Hash,
  RotateCcw,
  Archive,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Edit3,
  HelpCircle,
  FileSpreadsheet,
  Users,
  ShoppingCart,
  Package,
  Truck,
  FileText,
  Clock,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { apiFetch, apiUrl, safeJson } from '../../../api';

function authHeaders(user) {
  let activeId = user?.id || '';
  if (!activeId) {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('asicrm_user') : null;
      if (saved) activeId = JSON.parse(saved)?.id || '';
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    'x-user-id': activeId || 'USR-001'
  };
}

const MODULE_ICONS = {
  enquiries: HelpCircle,
  customers: Users,
  quotations: FileSpreadsheet,
  purchaseOrders: ShoppingCart,
  stocks: Package,
  deliveryChallans: Truck,
  invoices: FileText
};

export default function SerialNumberSetupSection({ user, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archives'

  // Edit Modal State
  const [editModule, setEditModule] = useState(null);
  const [editForm, setEditForm] = useState({
    prefix: '',
    suffix: '',
    paddingDigits: 3,
    startingNumber: 1,
    nextNumber: 1,
    resetPolicy: 'CALENDAR_YEAR'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Rollover Modal State
  const [rolloverModalOpen, setRolloverModalOpen] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);

  const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(apiUrl('/api/settings/sequences'), {
        headers: authHeaders(user)
      });
      const json = await safeJson(res);
      if (res.ok && json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.message || 'Failed to load sequence configuration.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to sequence engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (mod) => {
    setEditModule(mod);
    setEditForm({
      prefix: mod.prefix || '',
      suffix: mod.suffix || '',
      paddingDigits: mod.paddingDigits || 3,
      startingNumber: mod.startingNumber || 1,
      nextNumber: mod.nextNumber || 1,
      resetPolicy: mod.resetPolicy || 'CALENDAR_YEAR'
    });
  };

  const calculatePreview = (form, num = null, year = null) => {
    const pad = Math.max(1, parseInt(form.paddingDigits, 10) || 3);
    const n = num !== null ? num : (parseInt(form.nextNumber, 10) || 1);
    const yr = year || data?.currentCalendarYear || new Date().getFullYear();
    const formatted = String(n).padStart(pad, '0');
    const suffix = (form.suffix || '')
      .replace('{YYYY}', String(yr))
      .replace('{YY}', String(yr).slice(-2));
    return `${form.prefix || ''}${formatted}${suffix}`;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModule) return;
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/settings/sequences/${editModule.key}`), {
        method: 'PUT',
        headers: authHeaders(user),
        body: JSON.stringify(editForm)
      });
      const json = await safeJson(res);
      if (res.ok && json.success) {
        if (showToast) showToast(json.message || `Sequence for ${editModule.name} updated.`);
        setEditModule(null);
        await loadData();
      } else {
        alert(json.message || 'Failed to update sequence.');
      }
    } catch (err) {
      alert(err.message || 'Network error updating sequence.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteRollover = async () => {
    setIsRollingOver(true);
    try {
      const nextYr = (data?.currentCalendarYear || new Date().getFullYear()) + 1;
      const res = await apiFetch(apiUrl('/api/settings/sequences/rollover'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({ targetYear: nextYr })
      });
      const json = await safeJson(res);
      if (res.ok && json.success) {
        if (showToast) showToast(json.message || `Rollover to ${nextYr} complete and archived.`);
        setRolloverModalOpen(false);
        await loadData();
      } else {
        alert(json.message || 'Failed to execute year rollover.');
      }
    } catch (err) {
      alert(err.message || 'Network error during year rollover.');
    } finally {
      setIsRollingOver(false);
    }
  };

  const currentYear = data?.currentCalendarYear || new Date().getFullYear();
  const modulesList = data?.modules ? Object.values(data.modules) : [];
  const archivesList = data?.yearlyArchives || [];

  return (
    <div className="settings-section-container">
      {/* HEADER */}
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <h2 style={{ margin: 0 }}>Serial Numbers &amp; Document Sequences</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  padding: '3px 9px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  color: '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Calendar size={12} style={{ color: '#2563eb' }} />
                <span>Calendar Year: {currentYear} (Active)</span>
              </span>
              <span
                style={{
                  padding: '3px 9px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Hash size={12} style={{ color: '#16a34a' }} />
                <span>Standard 001 Sequence</span>
              </span>
            </div>
          </div>
          <p>
            Standardize auto-numbering to clean 3-digit serials (<code>001</code>) across all modules. Transaction documents automatically restart at <code>001</code> each Calendar Year (Jan 1 – Dec 31) with past years archived in the database.
          </p>
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
                borderColor: '#6366f1',
                color: '#4f46e5',
                fontWeight: 600
              }}
              onClick={() => setRolloverModalOpen(true)}
              title="Simulate or execute a Calendar Year rollover and archive previous year in database"
            >
              <RotateCcw size={15} />
              <span>Year Rollover &amp; Archive</span>
            </button>
          )}

          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={loadData}
            title="Refresh sequence engine stats"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* VIEW SELECTOR TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'active' ? '#2563eb' : 'transparent',
            color: activeTab === 'active' ? '#ffffff' : '#64748b',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Layers size={15} />
          <span>Active Module Sequences ({modulesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archives')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'archives' ? '#2563eb' : 'transparent',
            color: activeTab === 'archives' ? '#ffffff' : '#64748b',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Archive size={15} />
          <span>Historical Year Archives ({archivesList.length})</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* ========================================================
          TAB 1: ACTIVE MODULE SEQUENCES
          ======================================================== */}
      {activeTab === 'active' && (
        <div className="settings-table-wrapper">
          <div className="settings-table-scroll">
            <table className="settings-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Prefix</th>
                  <th style={{ textAlign: 'center' }}>Padding</th>
                  <th>Suffix / Year</th>
                  <th style={{ textAlign: 'center' }}>Next No.</th>
                  <th>Reset Policy</th>
                  <th>Live Next ID</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {modulesList.map((mod) => {
                  const Icon = MODULE_ICONS[mod.key] || FileText;
                  const isYearly = mod.resetPolicy === 'CALENDAR_YEAR';

                  return (
                    <tr key={mod.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Icon size={16} />
                          </div>
                          <div>
                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '13px' }}>
                              {mod.name}
                            </strong>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {mod.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <code style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                          {mod.prefix}
                        </code>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {mod.paddingDigits} digits ({String(1).padStart(mod.paddingDigits, '0')})
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                          {mod.suffix ? mod.suffix.replace('{YYYY}', String(currentYear)) : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          #{mod.nextNumber}
                        </span>
                      </td>

                      <td>
                        {isYearly ? (
                          <span
                            className="settings-pill-badge"
                            style={{
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontSize: '11px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}
                          >
                            Calendar Year (Jan 1)
                          </span>
                        ) : (
                          <span
                            className="settings-pill-badge"
                            style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              fontSize: '11px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}
                          >
                            Continuous Lifetime
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            padding: '4px 8px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#0f172a',
                            display: 'inline-block',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {mod.livePreview}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(mod)}
                          style={{ padding: '5px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: HISTORICAL YEAR ARCHIVES STORED IN DATABASE
          ======================================================== */}
      {activeTab === 'archives' && (
        <div className="settings-table-wrapper">
          <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={18} style={{ color: '#4f46e5' }} />
              <div>
                <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Past Calendar Year Sequence Archives</strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Whenever a calendar year ends, previous sequence ranges are preserved here for tax audits and historical lookup.
                </div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', padding: '3px 8px', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              {archivesList.length} Archived Years
            </span>
          </div>

          <div className="settings-table-scroll">
            <table className="settings-table">
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Module</th>
                  <th>Sequence Range Generated</th>
                  <th style={{ textAlign: 'center' }}>Total Documents</th>
                  <th>Archived Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {archivesList.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      <Archive size={28} style={{ display: 'block', margin: '0 auto 8px auto', opacity: 0.5 }} />
                      No past years archived yet. Current year {currentYear} is active. When year {currentYear} completes, its full sequence range will automatically appear here.
                    </td>
                  </tr>
                ) : (
                  archivesList.map((arc) => (
                    <tr key={arc.id}>
                      <td>
                        <strong style={{ color: '#1d4ed8', fontSize: '13px' }}>
                          {arc.year}
                        </strong>
                      </td>
                      <td>
                        <strong>{arc.moduleName}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {arc.range}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#059669' }}>
                          {arc.totalGenerated} documents
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(arc.archivedAt).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: CONFIGURE MODULE SEQUENCE
          ======================================================== */}
      {editModule && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} style={{ color: '#2563eb' }} />
                <h3 className="settings-modal-title" style={{ margin: 0 }}>
                  Configure {editModule.name} Serial Format
                </h3>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setEditModule(null)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="settings-modal-body" style={{ padding: '20px' }}>
                {/* LIVE PREVIEW BOX */}
                <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Live Preview of Next ID
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {calculatePreview(editForm)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Example at 1,250: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{calculatePreview(editForm, 1250)}</span> (expands automatically to infinity)
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Prefix</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={editForm.prefix}
                      onChange={(e) => setEditForm({ ...editForm, prefix: e.target.value })}
                      placeholder="e.g. ENQ/, QTN/, CUST-"
                      required
                    />
                  </div>

                  <div className="settings-field-group">
                    <label className="settings-field-label">Number Padding (Digits)</label>
                    <input
                      type="number"
                      className="settings-input"
                      value={editForm.paddingDigits}
                      onChange={(e) => setEditForm({ ...editForm, paddingDigits: parseInt(e.target.value, 10) || 3 })}
                      min="1"
                      max="8"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      3 = 001, 4 = 0001
                    </span>
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Suffix / Year Pattern</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={editForm.suffix}
                      onChange={(e) => setEditForm({ ...editForm, suffix: e.target.value })}
                      placeholder="/{YYYY}"
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Use <code>{'{YYYY}'}</code> for 2026, or leave blank
                    </span>
                  </div>

                  <div className="settings-field-group">
                    <label className="settings-field-label">Next Serial Counter</label>
                    <input
                      type="number"
                      className="settings-input"
                      value={editForm.nextNumber}
                      onChange={(e) => setEditForm({ ...editForm, nextNumber: parseInt(e.target.value, 10) || 1 })}
                      min="1"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Counter for the active year
                    </span>
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Annual Reset Policy</label>
                  <select
                    className="settings-select"
                    value={editForm.resetPolicy}
                    onChange={(e) => setEditForm({ ...editForm, resetPolicy: e.target.value })}
                  >
                    <option value="CALENDAR_YEAR">Calendar Year (Resets to 001 every Jan 1 with DB archive)</option>
                    <option value="CONTINUOUS">Continuous Lifetime (Never resets, e.g. Customers, Stocks)</option>
                  </select>
                </div>
              </div>

              <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setEditModule(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-btn settings-btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Sequence Format'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: MANUAL ROLLOVER TO NEXT YEAR
          ======================================================== */}
      {rolloverModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '480px' }}>
            <div className="settings-modal-header" style={{ background: '#f5f3ff', borderBottom: '1px solid #ddd6fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} style={{ color: '#6366f1' }} />
                <h3 className="settings-modal-title" style={{ color: '#4338ca', margin: 0 }}>
                  Execute Year Rollover &amp; Archive
                </h3>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setRolloverModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#1e293b' }}>
                Are you ready to roll over sequences from <strong>{currentYear}</strong> to <strong>{currentYear + 1}</strong>?
              </p>

              <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12.5px', color: '#475569', marginBottom: '14px' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>What happens during rollover:</strong>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  <li>All year {currentYear} generated counts and document ranges will be permanently archived in the database.</li>
                  <li>All annual document serials (Enquiries, Quotations, POs, Challans, Invoices) will reset cleanly to <code>001/{currentYear + 1}</code>.</li>
                  <li>Master entities (Customers, Stocks) remain continuous and will NOT reset.</li>
                </ul>
              </div>
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => setRolloverModalOpen(false)}
                disabled={isRollingOver}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#4f46e5', color: '#ffffff', borderColor: '#4338ca' }}
                onClick={handleExecuteRollover}
                disabled={isRollingOver}
              >
                {isRollingOver ? 'Archiving & Rolling Over...' : `Confirm Rollover to ${currentYear + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
