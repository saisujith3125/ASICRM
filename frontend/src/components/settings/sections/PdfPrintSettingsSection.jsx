import React from 'react';

const ACCENT_COLORS = [
  { name: 'ASI Blue', hex: '#2563eb' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Slate Dark', hex: '#0f172a' },
  { name: 'Indigo Corporate', hex: '#4338ca' },
  { name: 'Teal Modern', hex: '#0d9488' }
];

export default function PdfPrintSettingsSection({ data, onChange, onSave, isSaving }) {
  const pdf = data?.pdfSettings || {};

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      pdfSettings: {
        ...pdf,
        [field]: val
      }
    });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>PDF &amp; Print Engine Settings</h2>
          <p>Global typography, margins, page geometry, and brand accent colors applied when generating all official PDFs.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save PDF Settings'}
          </button>
        </div>
      </div>

      <div className="settings-two-col">
        {/* LEFT COLUMN: PAGE CONFIG */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Page Geometry &amp; Layout</h3>
                <p className="settings-card-desc">Standard paper dimensions and print margins.</p>
              </div>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">Standard Page Size</label>
                <select
                  className="settings-select"
                  value={pdf.pageSize || 'A4'}
                  onChange={(e) => handleUpdate('pageSize', e.target.value)}
                >
                  <option value="A4">A4 (210 x 297 mm)</option>
                  <option value="Letter">US Letter (8.5 x 11 in)</option>
                  <option value="Legal">US Legal (8.5 x 14 in)</option>
                </select>
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Orientation</label>
                <select
                  className="settings-select"
                  value={pdf.orientation || 'Portrait'}
                  onChange={(e) => handleUpdate('orientation', e.target.value)}
                >
                  <option value="Portrait">Portrait</option>
                  <option value="Landscape">Landscape</option>
                </select>
              </div>
            </div>

            <label className="settings-field-label" style={{ marginBottom: '8px' }}>Page Margins (mm)</label>
            <div className="settings-grid-4">
              <div className="settings-field-group">
                <span className="settings-field-hint">Top</span>
                <input
                  type="number"
                  className="settings-input"
                  value={pdf.marginTop || 10}
                  onChange={(e) => handleUpdate('marginTop', parseInt(e.target.value, 10) || 5)}
                />
              </div>
              <div className="settings-field-group">
                <span className="settings-field-hint">Bottom</span>
                <input
                  type="number"
                  className="settings-input"
                  value={pdf.marginBottom || 10}
                  onChange={(e) => handleUpdate('marginBottom', parseInt(e.target.value, 10) || 5)}
                />
              </div>
              <div className="settings-field-group">
                <span className="settings-field-hint">Left</span>
                <input
                  type="number"
                  className="settings-input"
                  value={pdf.marginLeft || 10}
                  onChange={(e) => handleUpdate('marginLeft', parseInt(e.target.value, 10) || 5)}
                />
              </div>
              <div className="settings-field-group">
                <span className="settings-field-hint">Right</span>
                <input
                  type="number"
                  className="settings-input"
                  value={pdf.marginRight || 10}
                  onChange={(e) => handleUpdate('marginRight', parseInt(e.target.value, 10) || 5)}
                />
              </div>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Header &amp; Footer Pagination</h3>
                <p className="settings-card-desc">Automatic page indexing and watermark overlays.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('showPageNumbers', pdf.showPageNumbers === false)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Print Dynamic Page Numbers</span>
                  <span className="settings-toggle-desc">Prints "Page X of Y" in document footer.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={pdf.showPageNumbers !== false}
                    onChange={(e) => handleUpdate('showPageNumbers', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>

              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('printDraftWatermark', !pdf.printDraftWatermark)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Print Draft Watermark</span>
                  <span className="settings-toggle-desc">Overlay light diagonal watermark on unpaid proformas.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={Boolean(pdf.printDraftWatermark)}
                    onChange={(e) => handleUpdate('printDraftWatermark', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BRANDING ACCENTS & PREVIEW */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Document Styling &amp; Colors</h3>
                <p className="settings-card-desc">Primary brand accent color applied to document table headers.</p>
              </div>
            </div>

            <div className="settings-field-group" style={{ marginBottom: '16px' }}>
              <label className="settings-field-label">Color Theme Accent</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                {ACCENT_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => handleUpdate('primaryColor', col.hex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: `2px solid ${(pdf.primaryColor || '#2563eb') === col.hex ? col.hex : '#e2e8f0'}`,
                      background: (pdf.primaryColor || '#2563eb') === col.hex ? '#f8fafc' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: col.hex }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">Document Font Stack</label>
              <select
                className="settings-select"
                value={pdf.fontFamily || 'Inter, system-ui, sans-serif'}
                onChange={(e) => handleUpdate('fontFamily', e.target.value)}
              >
                <option value="Inter, system-ui, sans-serif">Inter (Modern Clean)</option>
                <option value="Arial, Helvetica, sans-serif">Arial / Standard Corporate</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Times New Roman', serif">Times New Roman (Traditional)</option>
              </select>
            </div>
          </div>

          {/* SIMULATED PDF THUMBNAIL */}
          <div className="settings-card" style={{ textAlign: 'center', padding: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Document Geometry Simulation ({pdf.pageSize || 'A4'} • {pdf.orientation || 'Portrait'})
            </span>
            <div
              style={{
                width: '180px',
                height: pdf.orientation === 'Landscape' ? '128px' : '230px',
                margin: '16px auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                borderRadius: '4px',
                padding: `${(pdf.marginTop || 10) / 2}px ${(pdf.marginRight || 10) / 2}px ${(pdf.marginBottom || 10) / 2}px ${(pdf.marginLeft || 10) / 2}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontSize: '8px',
                color: '#64748b'
              }}
            >
              <div>
                <div style={{ height: '8px', width: '40px', background: pdf.primaryColor || '#2563eb', borderRadius: '2px', marginBottom: '4px' }} />
                <div style={{ height: '3px', width: '100%', background: '#f1f5f9', marginBottom: '3px' }} />
                <div style={{ height: '3px', width: '75%', background: '#f1f5f9' }} />
              </div>
              <div style={{ padding: '4px', background: '#f8fafc', borderRadius: '2px', border: `1px solid ${pdf.primaryColor || '#2563eb'}` }}>
                <div style={{ height: '4px', width: '60%', background: pdf.primaryColor || '#2563eb', borderRadius: '1px', marginBottom: '2px' }} />
                <div style={{ height: '2px', width: '90%', background: '#e2e8f0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '3px' }}>
                <span>ASI CRM</span>
                {pdf.showPageNumbers !== false && <span>Page 1 of 1</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
