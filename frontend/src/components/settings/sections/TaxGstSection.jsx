import React from 'react';

const STANDARD_GST_SLABS = [
  { slab: '0% Nil', cgst: '0%', sgst: '0%', igst: '0%', desc: 'Essential & exempt goods' },
  { slab: '5% Low', cgst: '2.5%', sgst: '2.5%', igst: '5%', desc: 'Standard hardware accessories' },
  { slab: '12% Medium', cgst: '6%', sgst: '6%', igst: '12%', desc: 'Commercial communication tools' },
  { slab: '18% Standard (Default)', cgst: '9%', sgst: '9%', igst: '18%', desc: 'CCTV, IP Cameras, Networking & IT Services' },
  { slab: '28% High', cgst: '14%', sgst: '14%', igst: '28%', desc: 'Luxury electronics & commercial displays' }
];

export default function TaxGstSection({ data, onChange, onSave, isSaving }) {
  const tax = data?.taxSetup || {
    gstin: '33AZPPS7068A1Z4',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    defaultGstRate: 18,
    enableCompositeScheme: false,
    enableRcm: true,
    ewayBillThreshold: 50000
  };

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      taxSetup: {
        ...tax,
        [field]: val
      }
    });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Tax &amp; GST Configuration</h2>
          <p>Indian Goods &amp; Services Tax (GST) registration, multi-rate tax brackets, CGST/SGST splitting, and E-Way bill thresholds.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Tax Setup'}
          </button>
        </div>
      </div>

      {/* PRIMARY GST DETAILS */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Enterprise GST Identity</h3>
            <p className="settings-card-desc">Master registration code and origin place of supply.</p>
          </div>
        </div>

        <div className="settings-grid-3">
          <div className="settings-field-group">
            <label className="settings-field-label">Active GSTIN</label>
            <input
              type="text"
              className="settings-input"
              value={tax.gstin || data?.gstin || '33AZPPS7068A1Z4'}
              onChange={(e) => handleUpdate('gstin', e.target.value.toUpperCase())}
              placeholder="33AZPPS7068A1Z4"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Origin State Code</label>
            <input
              type="text"
              className="settings-input"
              value={tax.stateCode || '33'}
              onChange={(e) => handleUpdate('stateCode', e.target.value)}
              placeholder="33"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Origin State Name</label>
            <input
              type="text"
              className="settings-input"
              value={tax.stateName || 'Tamil Nadu'}
              onChange={(e) => handleUpdate('stateName', e.target.value)}
              placeholder="Tamil Nadu"
            />
          </div>
        </div>
      </div>

      {/* STANDARD GST RATES TABLE */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Statutory GST Rates &amp; Splitting</h3>
            <p className="settings-card-desc">Intra-state transactions split into CGST + SGST; Inter-state applies IGST.</p>
          </div>
          <div className="settings-field-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Default Rate:</span>
            <select
              className="settings-select"
              style={{ width: 'auto' }}
              value={tax.defaultGstRate || 18}
              onChange={(e) => handleUpdate('defaultGstRate', parseInt(e.target.value, 10))}
            >
              <option value={0}>0%</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18% (Standard)</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        <div className="settings-table-wrapper" style={{ boxShadow: 'none' }}>
          <div className="settings-table-scroll">
            <table className="settings-table" style={{ minWidth: '780px' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '36%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Tax Bracket</th>
                  <th style={{ textAlign: 'center' }}>CGST</th>
                  <th style={{ textAlign: 'center' }}>SGST</th>
                  <th style={{ textAlign: 'center' }}>IGST</th>
                  <th>Category Applicability</th>
                </tr>
              </thead>
              <tbody>
                {STANDARD_GST_SLABS.map((s) => (
                  <tr key={s.slab}>
                    <td><strong>{s.slab}</strong></td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>{s.cgst}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>{s.sgst}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>{s.igst}</td>
                    <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>{s.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* COMPLIANCE & THRESHOLDS */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Statutory Compliances &amp; E-Way Bill</h3>
            <p className="settings-card-desc">Electronic waybill rules and reverse charge mechanisms.</p>
          </div>
        </div>

        <div className="settings-grid-2">
          <div className="settings-field-group">
            <label className="settings-field-label">E-Way Bill Mandatory Value Threshold (₹)</label>
            <input
              type="number"
              className="settings-input"
              value={tax.ewayBillThreshold || 50000}
              onChange={(e) => handleUpdate('ewayBillThreshold', parseInt(e.target.value, 10) || 50000)}
            />
            <span className="settings-field-hint">Consignments above this value require valid E-Way bill generation before transport.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              className="settings-toggle-row"
              onClick={() => handleUpdate('enableRcm', tax.enableRcm === false)}
            >
              <div className="settings-toggle-info">
                <span className="settings-toggle-label">Reverse Charge Mechanism (RCM)</span>
                <span className="settings-toggle-desc">Enable RCM checkbox on line items for unregistered vendor receipts.</span>
              </div>
              <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={tax.enableRcm !== false}
                  onChange={(e) => handleUpdate('enableRcm', e.target.checked)}
                />
                <span className="settings-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
