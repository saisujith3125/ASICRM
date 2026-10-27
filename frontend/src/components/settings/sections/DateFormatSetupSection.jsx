import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  RotateCcw,
  Edit3,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Truck,
  ShoppingCart,
  Receipt,
  Globe,
  Sliders,
  Check,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';
import { apiFetch, apiUrl, safeJson } from '../../../api';
import { setCachedDateSettings } from '../../../utils/dateUtils';

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
  quotations: FileSpreadsheet,
  invoices: FileText,
  deliveryChallans: Truck,
  purchaseOrders: ShoppingCart,
  proformaInvoices: Receipt,
  general: Clock
};

const PRESET_OPTIONS = [
  { id: 'YYYY/MM/DD', label: 'YYYY/MM/DD (ASI Proposal Standard)', separator: '/', sample: '2026/10/24' },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Indian Statutory Standard)', separator: '/', sample: '24/10/2026' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Corporate Standard)', separator: '/', sample: '10/24/2026' },
  { id: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY (Formal Business Standard)', separator: '-', sample: '24-Oct-2026' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601 Standard)', separator: '-', sample: '2026-10-24' },
  { id: 'DD.MM.YYYY', label: 'DD.MM.YYYY (European Dot Standard)', separator: '.', sample: '24.10.2026' }
];

export default function DateFormatSetupSection({ user, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Edit Modal State
  const [editModule, setEditModule] = useState(null);
  const [editForm, setEditForm] = useState({
    format: 'YYYY/MM/DD',
    separator: '/'
  });

  // Global settings form state
  const [globalFormat, setGlobalFormat] = useState('YYYY/MM/DD');
  const [globalSeparator, setGlobalSeparator] = useState('/');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [timeFormat, setTimeFormat] = useState('12_HOUR');
  const [modulesState, setModulesState] = useState({});

  const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(apiUrl('/api/settings/date-format'), {
        headers: authHeaders(user)
      });
      const json = await safeJson(res);
      if (res.ok && json.success && json.data) {
        const d = json.data;
        setData(d);
        setGlobalFormat(d.globalFormat || 'YYYY/MM/DD');
        setGlobalSeparator(d.globalSeparator || '/');
        setTimezone(d.timezone || 'Asia/Kolkata');
        setTimeFormat(d.timeFormat || '12_HOUR');
        setModulesState(d.modules || {});
        setCachedDateSettings(d);
      } else {
        setError(json.message || 'Failed to load date format configuration.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to date settings service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEditModule = (mod) => {
    setEditModule(mod);
    setEditForm({
      format: mod.format || 'YYYY/MM/DD',
      separator: mod.separator || '/'
    });
  };

  const handleApplyPresetToGlobal = (preset) => {
    setGlobalFormat(preset.id);
    if (preset.separator) {
      setGlobalSeparator(preset.separator);
    }
  };

  const calculateSampleDate = (formatPattern, sep = '/') => {
    const yyyy = '2026';
    const yy = '26';
    const mm = '10';
    const dd = '24';
    const mmm = 'Oct';

    const norm = (formatPattern || 'YYYY/MM/DD').toUpperCase();
    if (norm.startsWith('YYYY') && norm.endsWith('DD') && norm.includes('MM')) {
      return `${yyyy}${sep}${mm}${sep}${dd}`;
    }
    if (norm.startsWith('DD') && norm.endsWith('YYYY') && norm.includes('MMM')) {
      return `${dd}-${mmm}-${yyyy}`;
    }
    if (norm.startsWith('DD') && norm.endsWith('YYYY')) {
      return `${dd}${sep}${mm}${sep}${yyyy}`;
    }
    if (norm.startsWith('MM') && norm.endsWith('YYYY')) {
      return `${mm}${sep}${dd}${sep}${yyyy}`;
    }
    if (norm.startsWith('DD') && norm.endsWith('YY')) {
      return `${dd}${sep}${mm}${sep}${yy}`;
    }
    return `${yyyy}${sep}${mm}${sep}${dd}`;
  };

  const handleSaveEditModule = (e) => {
    e.preventDefault();
    if (!editModule) return;
    const modKey = editModule.key;
    setModulesState((prev) => ({
      ...prev,
      [modKey]: {
        ...prev[modKey],
        format: editForm.format,
        separator: editForm.separator
      }
    }));
    setEditModule(null);
    if (showToast) showToast(`Format for ${editModule.name} updated. Click "Save All Changes" to persist.`);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const payload = {
        globalFormat,
        globalSeparator,
        timezone,
        timeFormat,
        modules: modulesState
      };
      const res = await apiFetch(apiUrl('/api/settings/date-format'), {
        method: 'PUT',
        headers: authHeaders(user),
        body: JSON.stringify(payload)
      });
      const json = await safeJson(res);
      if (res.ok && json.success) {
        setData(json.data);
        setCachedDateSettings(json.data);
        if (showToast) showToast('✓ Date format settings saved & applied across all documents.');
        window.dispatchEvent(new CustomEvent('crm-date-settings-updated', { detail: json.data }));
      } else {
        alert(json.message || 'Failed to save date settings.');
      }
    } catch (err) {
      alert(err.message || 'Error saving date settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all date formats to official ASI CRM defaults (Proposals: YYYY/MM/DD, Invoices: DD/MM/YYYY)?')) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl('/api/settings/date-format/reset'), {
        method: 'POST',
        headers: authHeaders(user)
      });
      const json = await safeJson(res);
      if (res.ok && json.success) {
        setData(json.data);
        setGlobalFormat(json.data.globalFormat || 'YYYY/MM/DD');
        setGlobalSeparator(json.data.globalSeparator || '/');
        setTimezone(json.data.timezone || 'Asia/Kolkata');
        setTimeFormat(json.data.timeFormat || '12_HOUR');
        setModulesState(json.data.modules || {});
        setCachedDateSettings(json.data);
        if (showToast) showToast('✓ Date settings restored to official ASI CRM standards.');
        window.dispatchEvent(new CustomEvent('crm-date-settings-updated', { detail: json.data }));
      } else {
        alert(json.message || 'Failed to reset date settings.');
      }
    } catch (err) {
      alert(err.message || 'Error resetting date settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const modulesList = modulesState ? Object.values(modulesState) : [];

  return (
    <div className="settings-section-container">
      {/* HEADER */}
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <h2 style={{ margin: 0 }}>Date Format &amp; Presentation Master</h2>
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
                <span>Global Format: {globalFormat}</span>
              </span>
              <span
                style={{
                  padding: '3px 9px',
                  background: '#fdf4ff',
                  border: '1px solid #f0abfc',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  color: '#a21caf',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={12} style={{ color: '#c026d3' }} />
                <span>Proposal Standard: {modulesState?.quotations?.format || 'YYYY/MM/DD'}</span>
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
                <Globe size={12} style={{ color: '#16a34a' }} />
                <span>Timezone: {timezone}</span>
              </span>
            </div>
          </div>
          <p>
            Configure centralized date representations, module overrides, and calendar presentation rules. Customer-facing proposals, tax invoices, delivery challans, and CRM timelines format dates consistently without timezone drift.
          </p>
        </div>

        <div className="settings-section-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={handleResetDefaults}
            disabled={isSaving || loading}
            title="Reset all date formats to official ASI CRM defaults"
          >
            <RotateCcw size={14} />
            <span>Reset to ASI Defaults</span>
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleSaveAll}
            disabled={isSaving || loading}
          >
            <Check size={14} />
            <span>{isSaving ? 'Saving Settings...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="settings-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <Calendar size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <div>Loading date configuration...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* LIVE SIMULATOR / PREVIEW BOX */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px 20px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                  Live Real-Time Document Date Simulator
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  (Real-time simulation of generated document headers)
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}
            >
              {/* Proposal Header Card */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Customer Proposal Header
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  Proposal #: ASI/26-27/QT0007
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace', marginTop: '2px' }}>
                  Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {calculateSampleDate(modulesState?.quotations?.format || 'YYYY/MM/DD', modulesState?.quotations?.separator || '/')}
                </div>
              </div>

              {/* Tax Invoice Header Card */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Tax Invoice Document Header
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  Invoice #: ASI/26-27/INV0042
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace', marginTop: '2px' }}>
                  Date&nbsp;&nbsp;&nbsp;&nbsp;: {calculateSampleDate(modulesState?.invoices?.format || 'DD/MM/YYYY', modulesState?.invoices?.separator || '/')}
                </div>
              </div>

              {/* Delivery Challan Card */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Delivery Challan Dispatch
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  Challan #: ASI/26-27/DC0029
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#d97706', fontFamily: 'monospace', marginTop: '2px' }}>
                  Date&nbsp;&nbsp;&nbsp;&nbsp;: {calculateSampleDate(modulesState?.deliveryChallans?.format || 'DD/MM/YYYY', modulesState?.deliveryChallans?.separator || '/')}
                </div>
              </div>

              {/* Financial Year Span Card */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  FY 2026-27 Fiscal Period
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Fiscal Validity
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', fontFamily: 'monospace', marginTop: '2px' }}>
                  {calculateSampleDate(globalFormat, globalSeparator)} (Start: 2026/04/01)
                </div>
              </div>
            </div>

            {/* Quick Global Preset Selector */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                Global Format Presets (Click any preset to apply globally or test):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_OPTIONS.map((p) => {
                  const isSelected = globalFormat === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPresetToGlobal(p)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#1d4ed8' : '#334155',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected && <Check size={12} style={{ color: '#2563eb' }} />}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MODULE-LEVEL FORMAT CONFIGURATION TABLE */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Document &amp; Module Date Overrides
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Fine-tune date formats per business document. Customer proposals strictly honor the <code>YYYY/MM/DD</code> specification.
                </p>
              </div>
            </div>

            <div className="settings-table-scroll" style={{ overflowX: 'auto', width: '100%' }}>
              <table className="settings-table" style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <colgroup>
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Module / Document</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Format Pattern</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Separator</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Rendered Live Sample</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {modulesList.map((mod) => {
                    const Icon = MODULE_ICONS[mod.key] || Calendar;
                    const sample = calculateSampleDate(mod.format, mod.separator);
                    const isProposal = mod.key === 'quotations';

                    return (
                      <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: isProposal ? '#eff6ff' : '#f8fafc',
                                border: isProposal ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Icon size={16} style={{ color: isProposal ? '#2563eb' : '#475569' }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                {mod.name}
                                {isProposal && (
                                  <span
                                    style={{
                                      marginLeft: '8px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    PROPOSAL STANDARD
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>{mod.description}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              fontSize: '12px',
                              color: '#334155',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {mod.format}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#475569',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {mod.separator}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isProposal ? '#2563eb' : '#0f172a',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sample}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModule(mod)}
                            className="settings-btn settings-btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          >
                            <Edit3 size={13} />
                            <span>Customize</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TIMEZONE & SYSTEM DISPLAY CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Timezone &amp; Clock Format
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  System Timezone
                </label>
                <select
                  className="settings-input"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+05:30) — Primary Office</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+08:00)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Used to prevent date-shift bugs when converting canonical UTC timestamps.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Time Display Format
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="timeFormat"
                      value="12_HOUR"
                      checked={timeFormat === '12_HOUR'}
                      onChange={() => setTimeFormat('12_HOUR')}
                    />
                    <span>12-Hour (e.g. 03:45 PM)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="timeFormat"
                      value="24_HOUR"
                      checked={timeFormat === '24_HOUR'}
                      onChange={() => setTimeFormat('24_HOUR')}
                    />
                    <span>24-Hour (e.g. 15:45)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODULE MODAL */}
      {editModule && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setEditModule(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={16} style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                  Configure Format: {editModule.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditModule(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModule} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Date Format Pattern
                </label>
                <select
                  value={editForm.format}
                  onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {PRESET_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Date Separator
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['/', '-', '.'].map((sep) => (
                    <button
                      key={sep}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, separator: sep })}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: editForm.separator === sep ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: editForm.separator === sep ? '#eff6ff' : '#ffffff',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {sep} {sep === '/' ? '(Slash)' : sep === '-' ? '(Hyphen)' : '(Dot)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Live Preview Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Live Document Preview
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace', marginTop: '4px' }}>
                  Date : {calculateSampleDate(editForm.format, editForm.separator)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setEditModule(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="settings-btn settings-btn-primary">
                  Apply Module Format
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
