import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';
import {
  normalizeWarehouseLayout,
  countWarehouseBins,
  createDefaultLayout,
  formatLocationString
} from '../../../utils/warehouseLayoutHelper';

const emptyWarehouse = {
  name: '',
  code: '',
  location: '',
  capacity: '5,000 sq ft',
  manager: '',
  isDefault: false,
  status: 'Active'
};

export default function WarehousesSection({ data, onChange, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyWarehouse);

  // Storage Layout & Bins Modal State
  const [layoutWh, setLayoutWh] = useState(null);
  const [activeFloorIdx, setActiveFloorIdx] = useState(0);

  const rawWarehouses = Array.isArray(data?.warehouses) ? data.warehouses : [];
  const warehouses = useMemo(() => {
    return rawWarehouses.map(normalizeWarehouseLayout);
  }, [rawWarehouses]);

  // Sorting state for table logic
  const [sortField, setSortField] = useState('code');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleSetDefault = (id) => {
    const updatedList = warehouses.map((w) => ({
      ...w,
      isDefault: w.id === id
    }));
    onChange({ ...data, warehouses: updatedList });
  };

  const filtered = useMemo(() => {
    const searched = filterRecordsBySearch(warehouses, search, [
      (w) => w.name,
      (w) => w.code,
      (w) => w.location,
      (w) => w.capacity,
      (w) => w.manager,
      (w) => w.status
    ]);

    return [...searched].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (sortField === 'bins') {
        const statsA = countWarehouseBins(a);
        const statsB = countWarehouseBins(b);
        valA = statsA.boxes;
        valB = statsB.boxes;
      }
      if (sortField === 'isDefault') {
        valA = a.isDefault ? 1 : 0;
        valB = b.isDefault ? 1 : 0;
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [warehouses, search, sortField, sortDir]);

  const handleOpenCreate = () => {
    const nextNum = warehouses.length + 1;
    const defaultCode = `WH-CHN-${String(nextNum).padStart(2, '0')}`;
    setDraft({ ...emptyWarehouse, code: defaultCode });
    setSelectedId(null);
    setModalMode('create');
  };

  const handleOpenEdit = (wh) => {
    setDraft({ ...wh });
    setSelectedId(wh.id);
    setModalMode('edit');
  };

  const handleOpenLayout = (wh) => {
    const normalized = normalizeWarehouseLayout(wh);
    setLayoutWh(JSON.parse(JSON.stringify(normalized)));
    setActiveFloorIdx(0);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;

    let updatedList;
    if (modalMode === 'create') {
      const newId = `WH-${Date.now().toString().slice(-4)}`;
      const newWh = normalizeWarehouseLayout({
        ...draft,
        id: newId,
        layout: createDefaultLayout(draft.name, draft.code)
      });
      if (newWh.isDefault) {
        updatedList = warehouses.map((w) => ({ ...w, isDefault: false }));
        updatedList.push(newWh);
      } else {
        updatedList = [...warehouses, newWh];
      }
    } else {
      updatedList = warehouses.map((w) => {
        if (w.id === selectedId) {
          return normalizeWarehouseLayout({
            ...draft,
            id: selectedId,
            layout: w.layout || createDefaultLayout(draft.name, draft.code)
          });
        }
        if (draft.isDefault) {
          return { ...w, isDefault: false };
        }
        return w;
      });
    }

    onChange({ ...data, warehouses: updatedList });
    setModalMode(null);
  };

  const handleDelete = (id) => {
    const wh = warehouses.find((w) => w.id === id);
    if (wh?.isDefault) {
      alert('Cannot delete the default central warehouse. Designate another default first.');
      return;
    }
    if (window.confirm('Are you sure you want to remove this storage warehouse?')) {
      const updatedList = warehouses.filter((w) => w.id !== id);
      onChange({ ...data, warehouses: updatedList });
    }
  };

  const handleToggleStatus = (id) => {
    const updatedList = warehouses.map((w) => {
      if (w.id === id) {
        return { ...w, status: w.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return w;
    });
    onChange({ ...data, warehouses: updatedList });
  };

  // Layout Modal Handlers
  const handleSaveLayout = () => {
    if (!layoutWh) return;
    const updatedList = warehouses.map((w) => (w.id === layoutWh.id ? layoutWh : w));
    onChange({ ...data, warehouses: updatedList });
    setLayoutWh(null);
  };

  const handleResetToStandardGrid = () => {
    if (!layoutWh) return;
    if (window.confirm('Reset this warehouse layout to standard Medical Store / Pharmacy Grid (2 Floors, 4 Racks, Multiple Shelves & Boxes)?')) {
      const freshLayout = createDefaultLayout(layoutWh.name, layoutWh.code);
      setLayoutWh({ ...layoutWh, layout: freshLayout });
      setActiveFloorIdx(0);
    }
  };

  const handleAddFloor = () => {
    if (!layoutWh) return;
    const floors = layoutWh.layout?.floors || [];
    const num = floors.length + 1;
    const newFloor = {
      id: `FL-${String(num).padStart(2, '0')}`,
      name: `Floor ${num}`,
      code: `FL-${num}`,
      racks: [
        {
          id: `RK-${String.fromCharCode(65 + ((num - 1) * 2))}`,
          name: `Rack ${String.fromCharCode(65 + ((num - 1) * 2))}`,
          code: `RK-${String.fromCharCode(65 + ((num - 1) * 2))}`,
          shelves: [
            {
              id: 'SH-01',
              name: 'Shelf 1',
              code: 'SH-01',
              boxes: [
                { id: `BX-${String.fromCharCode(65 + ((num - 1) * 2))}1-01`, name: 'Box 01', code: 'BX-01', desc: 'Storage Box' }
              ]
            }
          ]
        }
      ]
    };
    setLayoutWh({
      ...layoutWh,
      layout: {
        ...layoutWh.layout,
        floors: [...floors, newFloor]
      }
    });
    setActiveFloorIdx(floors.length);
  };

  const handleAddRack = (floorIdx) => {
    if (!layoutWh) return;
    const floors = [...(layoutWh.layout?.floors || [])];
    const fl = floors[floorIdx];
    if (!fl) return;
    const racks = fl.racks || [];
    const rackLetter = String.fromCharCode(65 + (racks.length % 26));
    const newRack = {
      id: `RK-${rackLetter}-${Date.now().toString().slice(-3)}`,
      name: `Rack ${rackLetter}`,
      code: `RK-${rackLetter}`,
      shelves: [
        {
          id: 'SH-01',
          name: 'Shelf 1',
          code: 'SH-01',
          boxes: [
            { id: `BX-${rackLetter}1-01`, name: `Box ${rackLetter}1-01`, code: 'BX-01', desc: 'General Storage' }
          ]
        }
      ]
    };
    fl.racks = [...racks, newRack];
    setLayoutWh({
      ...layoutWh,
      layout: { ...layoutWh.layout, floors }
    });
  };

  const handleAddShelf = (floorIdx, rackIdx) => {
    if (!layoutWh) return;
    const floors = [...(layoutWh.layout?.floors || [])];
    const fl = floors[floorIdx];
    const rk = fl?.racks?.[rackIdx];
    if (!rk) return;
    const shelves = rk.shelves || [];
    const sNum = shelves.length + 1;
    const newShelf = {
      id: `SH-${String(sNum).padStart(2, '0')}`,
      name: `Shelf ${sNum}`,
      code: `SH-${sNum}`,
      boxes: [
        { id: `BX-${rk.code?.replace('RK-', '')}${sNum}-01`, name: `Box ${rk.code?.replace('RK-', '')}${sNum}-01`, code: 'BX-01', desc: 'Bin' }
      ]
    };
    rk.shelves = [...shelves, newShelf];
    setLayoutWh({
      ...layoutWh,
      layout: { ...layoutWh.layout, floors }
    });
  };

  const handleAddBox = (floorIdx, rackIdx, shelfIdx) => {
    if (!layoutWh) return;
    const floors = [...(layoutWh.layout?.floors || [])];
    const fl = floors[floorIdx];
    const rk = fl?.racks?.[rackIdx];
    const sh = rk?.shelves?.[shelfIdx];
    if (!sh) return;
    const boxes = sh.boxes || [];
    const bNum = boxes.length + 1;
    const rkCode = rk.code?.replace('RK-', '') || 'A';
    const sCode = sh.code?.replace('SH-', '') || '1';
    const newBox = {
      id: `BX-${rkCode}${sCode}-${String(bNum).padStart(2, '0')}`,
      name: `Box ${rkCode}${sCode}-${String(bNum).padStart(2, '0')}`,
      code: `BX-${String(bNum).padStart(2, '0')}`,
      desc: 'Storage Bin'
    };
    sh.boxes = [...boxes, newBox];
    setLayoutWh({
      ...layoutWh,
      layout: { ...layoutWh.layout, floors }
    });
  };

  const handleDeleteBox = (floorIdx, rackIdx, shelfIdx, boxIdx) => {
    if (!layoutWh) return;
    const floors = [...(layoutWh.layout?.floors || [])];
    const fl = floors[floorIdx];
    const rk = fl?.racks?.[rackIdx];
    const sh = rk?.shelves?.[shelfIdx];
    if (!sh) return;
    sh.boxes = (sh.boxes || []).filter((_, idx) => idx !== boxIdx);
    setLayoutWh({
      ...layoutWh,
      layout: { ...layoutWh.layout, floors }
    });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Warehouses &amp; Fulfillment Centers</h2>
          <p>Configure central godowns, local fulfillment hubs, storage capacities, and dispatch leads.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Warehouse
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
              placeholder="Search warehouses by code, name, city, manager..."
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Showing <strong>{filtered.length}</strong> of {warehouses.length} warehouses
            </span>
            {filtered.length > 0 && (
              <span style={{ fontSize: '11.5px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                {filtered.filter(w => w.status === 'Active').length} Active
              </span>
            )}
          </div>
        </div>

        <div className="settings-table-scroll" style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
          <table
            className="settings-table warehouses-fitted-table"
            style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', margin: 0 }}
          >
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('code')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Code"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Code</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'code' ? 1 : 0.35, color: sortField === 'code' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'code' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Facility Name"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Facility Name</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'name' ? 1 : 0.35, color: sortField === 'name' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Storage Area"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Storage Area</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'location' ? 1 : 0.35, color: sortField === 'location' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'location' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('capacity')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Capacity"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Capacity</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'capacity' ? 1 : 0.35, color: sortField === 'capacity' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'capacity' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('manager')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Lead Manager"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Lead</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'manager' ? 1 : 0.35, color: sortField === 'manager' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'manager' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('bins')}
                  style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 6px' }}
                  title="Click to sort by Storage Bins"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Storage Bins</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'bins' ? 1 : 0.35, color: sortField === 'bins' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'bins' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('isDefault')}
                  style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', padding: '8px 4px' }}
                  title="Click to sort by Default"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                    <span>Default</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'isDefault' ? 1 : 0.35, color: sortField === 'isDefault' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'isDefault' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', padding: '8px 4px' }}
                  title="Click to sort by Status"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                    <span>Status</span>
                    <span style={{ fontSize: '9px', opacity: sortField === 'status' ? 1 : 0.35, color: sortField === 'status' ? '#2563eb' : 'inherit' }}>
                      {sortField === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th style={{ textAlign: 'right', padding: '8px 6px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '24px' }}>🔍</span>
                      <strong style={{ fontSize: '13px', color: '#475569' }}>
                        {search.trim() ? `No warehouses matching "${search.trim()}"` : 'No warehouses configured.'}
                      </strong>
                      {search.trim() && (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="settings-btn settings-btn-secondary"
                          style={{ fontSize: '11.5px', marginTop: '4px' }}
                        >
                          Clear Search Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((wh) => {
                  const binStats = countWarehouseBins(wh);

                  return (
                    <tr key={wh.id}>
                      <td style={{ padding: '6px 6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>
                          {wh.code}
                        </span>
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <strong style={{ color: '#0f172a', fontSize: '12.5px', display: 'block', wordBreak: 'break-word' }}>
                          {wh.name}
                        </strong>
                      </td>
                      <td style={{ padding: '6px 6px', fontSize: '12px', color: '#475569', wordBreak: 'break-word' }}>
                        {wh.location || '—'}
                      </td>
                      <td style={{ padding: '6px 4px', fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {wh.capacity || '—'}
                      </td>
                      <td style={{ padding: '6px 6px', fontSize: '12px', color: '#334155', wordBreak: 'break-word' }}>
                        {wh.manager || '—'}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenLayout(wh)}
                          className="settings-pill-badge"
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10.5px',
                            padding: '2px 5px',
                            borderRadius: '5px',
                            whiteSpace: 'nowrap'
                          }}
                          title="Click to view and configure Floor › Rack › Shelf › Box storage bins"
                        >
                          <span aria-hidden="true">📍</span>
                          <span><strong>{binStats.floors}F</strong>·{binStats.racks}R·<strong>{binStats.boxes} Bins</strong></span>
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 2px' }}>
                        {wh.isDefault ? (
                          <span
                            className="settings-pill-badge primary"
                            style={{
                              fontWeight: 700,
                              fontSize: '10.5px',
                              padding: '2.5px 6px',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px'
                            }}
                          >
                            ★ Default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(wh.id)}
                            className="settings-btn settings-btn-secondary"
                            style={{
                              fontSize: '10px',
                              padding: '2px 5px',
                              color: '#64748b',
                              borderStyle: 'dashed',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Set as default facility"
                          >
                            Set Default
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 2px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(wh.id)}
                          className={`settings-pill-badge ${wh.status === 'Active' ? 'active' : 'inactive'}`}
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '10.5px',
                            padding: '2px 6px',
                            whiteSpace: 'nowrap'
                          }}
                          title="Click to toggle status"
                        >
                          {wh.status}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>
                        <div
                          className="settings-table-actions-group"
                          style={{
                            display: 'inline-flex',
                            gap: '3px',
                            justifyContent: 'flex-end',
                            flexWrap: 'nowrap',
                            alignItems: 'center'
                          }}
                        >
                          <button
                            type="button"
                            className="settings-btn settings-btn-primary"
                            onClick={() => handleOpenLayout(wh)}
                            title="Manage Floor › Rack › Shelf › Box Storage Bins"
                            style={{
                              fontSize: '10px',
                              padding: '2.5px 5px',
                              background: '#0284c7',
                              borderColor: '#0284c7',
                              color: '#fff',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <span>📍</span> Layout
                          </button>
                          <button
                            type="button"
                            className="settings-btn settings-btn-secondary"
                            onClick={() => handleOpenEdit(wh)}
                            title="Edit Warehouse Details"
                            style={{
                              fontSize: '10px',
                              padding: '2.5px 5px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="settings-btn settings-btn-outline-danger"
                            onClick={() => handleDelete(wh.id)}
                            title="Delete Warehouse"
                            style={{
                              fontSize: '10px',
                              padding: '2.5px 5px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              color: '#ef4444',
                              borderColor: '#fca5a5'
                            }}
                          >
                            Delete
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

      {/* CREATE / EDIT MODAL */}
      {modalMode && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Add New Storage Warehouse' : 'Edit Fulfillment Warehouse'}
              </h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setModalMode(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="settings-modal-body">
                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Warehouse Code <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="WH-CHN-01"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Warehouse Name <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      required
                      placeholder="Main Central Hub"
                    />
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Physical Location &amp; Area <span className="settings-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="settings-input"
                    value={draft.location}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    required
                    placeholder="Vanagaram, Chennai"
                  />
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Storage Capacity</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.capacity}
                      onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                      placeholder="10,000 sq ft"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Warehouse Lead / Manager</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.manager}
                      onChange={(e) => setDraft({ ...draft, manager: e.target.value })}
                      placeholder="Vijay / Gokul"
                    />
                  </div>
                </div>

                <div className="settings-toggle-row" onClick={() => setDraft({ ...draft, isDefault: !draft.isDefault })}>
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-label">Default Central Hub</span>
                    <span className="settings-toggle-desc">Set as primary source for new stock receipt and delivery challan dispatches.</span>
                  </div>
                  <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={draft.isDefault}
                      onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                    />
                    <span className="settings-slider" />
                  </label>
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
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STORAGE LAYOUT & BINS MODAL (Floor -> Rack -> Shelf -> Box) */}
      {layoutWh && (
        <div className="settings-modal-overlay">
          <div
            className="settings-modal-card"
            style={{ maxWidth: '820px', width: '95%' }}
          >
            <div className="settings-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 className="settings-modal-title" style={{ fontSize: '17px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📍 Warehouse Storage Layout &amp; Picking Bins</span>
                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {layoutWh.name} ({layoutWh.code})
                  </span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Organized medical-store style hierarchy: <strong>Floor › Rack › Shelf › Box</strong> so warehouse workers and new staff can locate products immediately.
                </p>
              </div>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setLayoutWh(null)}
              >
                ✕
              </button>
            </div>

            <div className="settings-modal-body" style={{ padding: '18px 20px', maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Medical Store Concept Info Banner */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🏥</span>
                  <div>
                    <strong style={{ color: '#166534', fontSize: '12.5px', display: 'block' }}>
                      Medical Store / Pharmacy Picking Flow Active
                    </strong>
                    <span style={{ color: '#15803d', fontSize: '11.5px' }}>
                      New stock receipts and dispatches will display this exact bin coordinate for instant item retrieval.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetToStandardGrid}
                  className="settings-btn settings-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '3px 10px', background: '#fff', color: '#166534', borderColor: '#86efac' }}
                  title="Auto-generate standard multi-floor picking grid"
                >
                  ⚡ Reset to Standard Grid
                </button>
              </div>

              {/* Floor Tabs Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', marginBottom: '16px', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                  {(layoutWh.layout?.floors || []).map((fl, fIdx) => (
                    <button
                      key={fl.id || fIdx}
                      type="button"
                      onClick={() => setActiveFloorIdx(fIdx)}
                      style={{
                        padding: '8px 14px',
                        border: 'none',
                        borderBottom: activeFloorIdx === fIdx ? '3px solid #2563eb' : '3px solid transparent',
                        background: activeFloorIdx === fIdx ? '#eff6ff' : 'transparent',
                        color: activeFloorIdx === fIdx ? '#1d4ed8' : '#64748b',
                        fontWeight: activeFloorIdx === fIdx ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                        borderRadius: '6px 6px 0 0',
                        marginBottom: '-2px'
                      }}
                    >
                      🏢 {fl.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddFloor}
                  className="settings-btn settings-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '3px 10px', height: '28px', marginBottom: '4px' }}
                >
                  + Add Floor
                </button>
              </div>

              {/* Active Floor Content */}
              {(() => {
                const curFloor = layoutWh.layout?.floors?.[activeFloorIdx];
                if (!curFloor) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No floors configured. Click "+ Add Floor" to begin.
                    </div>
                  );
                }

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                          Racks on {curFloor.name}
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                          ({curFloor.racks?.length || 0} Racks configured)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddRack(activeFloorIdx)}
                        className="settings-btn settings-btn-primary"
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                      >
                        + Add Rack to {curFloor.name}
                      </button>
                    </div>

                    {/* Racks List */}
                    {(curFloor.racks || []).length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                        No racks on this floor yet. Click "+ Add Rack" to start organizing shelves.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {curFloor.racks.map((rk, rIdx) => (
                          <div
                            key={rk.id || rIdx}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              background: '#fff',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              overflow: 'hidden'
                            }}
                          >
                            <div style={{ background: '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '15px' }}>🗄️</span>
                                <strong style={{ color: '#1e293b', fontSize: '13px' }}>{rk.name}</strong>
                                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                                  {rk.code}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddShelf(activeFloorIdx, rIdx)}
                                className="settings-btn settings-btn-secondary"
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                              >
                                + Add Shelf
                              </button>
                            </div>

                            {/* Shelves & Boxes Grid */}
                            <div style={{ padding: '12px 14px' }}>
                              {(rk.shelves || []).length === 0 ? (
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No shelves in this rack. Add a shelf to place storage boxes.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {rk.shelves.map((sh, sIdx) => (
                                    <div
                                      key={sh.id || sIdx}
                                      style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        padding: '10px 12px'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '13px' }}>📦</span>
                                          <strong style={{ fontSize: '12.5px', color: '#334155' }}>{sh.name}</strong>
                                          <span style={{ fontSize: '11px', color: '#64748b' }}>({sh.boxes?.length || 0} Boxes)</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleAddBox(activeFloorIdx, rIdx, sIdx)}
                                          style={{
                                            border: '1px solid #cbd5e1',
                                            background: '#fff',
                                            borderRadius: '4px',
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            color: '#2563eb'
                                          }}
                                        >
                                          + Add Box
                                        </button>
                                      </div>

                                      {/* Boxes Pills */}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {(sh.boxes || []).map((bx, bIdx) => {
                                          const boxName = typeof bx === 'string' ? bx : bx.name;
                                          const boxDesc = typeof bx === 'object' ? bx.desc : '';

                                          return (
                                            <div
                                              key={bx.id || bIdx}
                                              style={{
                                                background: '#fff',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                fontSize: '11.5px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                              }}
                                              title={boxDesc ? `${boxName}: ${boxDesc}` : boxName}
                                            >
                                              <span style={{ color: '#0284c7' }}>🏷️</span>
                                              <strong style={{ color: '#0f172a' }}>{boxName}</strong>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteBox(activeFloorIdx, rIdx, sIdx, bIdx)}
                                                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                                                title="Remove box"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Changes will be saved to this warehouse's layout configuration.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setLayoutWh(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="settings-btn settings-btn-primary"
                  onClick={handleSaveLayout}
                >
                  Save Storage Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
