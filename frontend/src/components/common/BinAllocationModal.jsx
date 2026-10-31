import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, X, Check } from 'lucide-react';

/**
 * Smart automatic storage bin detector based on product category, SKU, and naming
 */
export function computeDefaultAllocation(item, warehouse) {
  const whId = warehouse?.id || 'WH-001';
  const whName = warehouse?.name || 'Main Central Hub';
  const whCode = warehouse?.code || 'WH-CHN-01';

  const floors = warehouse?.layout?.floors;
  if (!Array.isArray(floors) || floors.length === 0) {
    return {
      warehouseId: whId,
      warehouseName: whName,
      floorId: 'FL-01',
      floorName: 'Floor 1 (Ground Floor)',
      rackId: 'RK-A',
      rackName: 'Rack A (CCTV & Surveillance)',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1 (Bottom Tier)',
      boxId: 'BX-A1-01',
      boxName: 'Box A1-01 (Bullet Cameras)',
      boxCode: 'BX-01',
      locationCode: `${whCode}-FL-01-RK-A-SH-01-BX-01`,
      binLocation: `${whName} › Floor 1 (Ground Floor) › Rack A (CCTV & Surveillance) › Shelf 1 (Bottom Tier) › Box A1-01 (Bullet Cameras)`
    };
  }

  // Flatten all boxes with their parent coordinates
  const flatBoxes = [];
  floors.forEach((fl) => {
    (fl.racks || []).forEach((rk) => {
      (rk.shelves || []).forEach((sh) => {
        (sh.boxes || []).forEach((bx) => {
          flatBoxes.push({
            floorId: fl.id,
            floorName: fl.name,
            floorCode: fl.code,
            rackId: rk.id,
            rackName: rk.name,
            rackCode: rk.code,
            shelfId: sh.id,
            shelfName: sh.name,
            shelfCode: sh.code,
            boxId: bx.id,
            boxName: bx.name,
            boxCode: bx.code || 'BX-01',
            boxDesc: bx.desc || '',
            fullSearch: `${fl.name} ${rk.name} ${sh.name} ${bx.name} ${bx.desc || ''}`.toLowerCase()
          });
        });
      });
    });
  });

  if (flatBoxes.length === 0) {
    return {
      warehouseId: whId,
      warehouseName: whName,
      floorId: 'FL-01',
      floorName: 'Floor 1',
      rackId: 'RK-A',
      rackName: 'Rack A',
      shelfId: 'SH-01',
      shelfName: 'Shelf 1',
      boxId: 'BX-A1-01',
      boxName: 'Box 01',
      boxCode: 'BX-01',
      locationCode: `${whCode}-FL-01-RK-A-SH-01-BX-01`,
      binLocation: `${whName} › Floor 1 › Rack A › Shelf 1 › Box 01`
    };
  }

  const name = String(item?.productName || item?.name || '').toLowerCase();
  const code = String(item?.productCode || item?.code || '').toUpperCase();
  const cat = String(item?.categoryId || '').toUpperCase();

  let matched = null;

  // 1. Cables & Wires
  if (cat.includes('CAT-000004') || name.includes('cable') || name.includes('utp') || code.includes('CAB-') || code.includes('CBL-')) {
    matched = flatBoxes.find((b) => b.fullSearch.includes('cable') || b.fullSearch.includes('reels')) ||
              flatBoxes.find((b) => b.rackName.includes('Networking') || b.rackId === 'RK-D');
  }
  // 2. Bullet Cameras
  else if (name.includes('bullet') || code.includes('CAM-IPC-001') || code.includes('ASI01') || code.includes('ASI-14')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('bullet'));
  }
  // 3. Dome Cameras
  else if (name.includes('dome') || code.includes('CAM-IPC-002') || code.includes('DOME')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('dome'));
  }
  // 4. PTZ Cameras & High End
  else if (name.includes('ptz') || code.includes('ASI-04') || code.includes('ASI-PRO')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('ptz'));
  }
  // 5. IP Cameras / Network Cameras
  else if (code.includes('ASI-CAM') || name.includes('optical vision') || (name.includes('camera') && !name.includes('box'))) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('ip network') || b.fullSearch.includes('poe camera'));
  }
  // 6. Recorders (NVR / DVR)
  else if (name.includes('nvr') || name.includes('dvr') || code.includes('REC-') || code.includes('NVR-') || code.includes('DVR-')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('nvr') || b.boxName.toLowerCase().includes('dvr'));
  }
  // 7. Surveillance HDDs
  else if (name.includes('hdd') || name.includes('hard disk') || code.includes('HDD') || code.includes('ASI-15')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('hdd') || b.boxName.toLowerCase().includes('hard disk'));
  }
  // 8. Biometrics & Access Control
  else if (name.includes('biometric') || name.includes('fingerprint') || name.includes('facial') || name.includes('lock') || code.includes('BIO-') || code.includes('LCK-')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('fingerprint') || b.boxName.toLowerCase().includes('em locks') || b.rackName.includes('Biometrics'));
  }
  // 9. Switches & Network
  else if (name.includes('switch') || name.includes('poe') || code.includes('NET-SW') || code.includes('ASI-16') || code.includes('ASI-17')) {
    matched = flatBoxes.find((b) => b.boxName.toLowerCase().includes('poe switches') || b.boxName.toLowerCase().includes('managed switches'));
  }
  // 10. General CCTV
  else if (cat.includes('CCTV') || name.includes('cctv')) {
    matched = flatBoxes.find((b) => b.rackName.includes('CCTV') || b.rackId === 'RK-A');
  }

  // Fallback to first box
  if (!matched) matched = flatBoxes[0];

  const locCode = matched.boxCode
    ? `${whCode}-${matched.floorCode || 'FL-01'}-${matched.rackCode || 'RK-A'}-${matched.shelfCode || 'SH-01'}-${matched.boxCode}`
    : `${whId}-${matched.boxId}`;

  const binLocation = `${whName} › ${matched.floorName} › ${matched.rackName} › ${matched.shelfName} › ${matched.boxName}`;

  return {
    warehouseId: whId,
    warehouseName: whName,
    floorId: matched.floorId,
    floorName: matched.floorName,
    rackId: matched.rackId,
    rackName: matched.rackName,
    shelfId: matched.shelfId,
    shelfName: matched.shelfName,
    boxId: matched.boxId,
    boxName: matched.boxName,
    boxCode: matched.boxCode,
    locationCode: locCode,
    binLocation
  };
}

/**
 * Interactive Bin Allocation Modal Component
 */
export default function BinAllocationModal({ isOpen, onClose, onSave, item, currentAllocation, warehouses }) {
  const [selectedWhId, setSelectedWhId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedRackId, setSelectedRackId] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('');

  const activeWh = useMemo(() => {
    return (warehouses || []).find((w) => w.id === selectedWhId) || (warehouses || [])[0] || null;
  }, [warehouses, selectedWhId]);

  const activeFloors = useMemo(() => {
    return activeWh?.layout?.floors || [];
  }, [activeWh]);

  const activeFloor = useMemo(() => {
    return activeFloors.find((f) => f.id === selectedFloorId) || activeFloors[0] || null;
  }, [activeFloors, selectedFloorId]);

  const activeRacks = useMemo(() => {
    return activeFloor?.racks || [];
  }, [activeFloor]);

  const activeRack = useMemo(() => {
    return activeRacks.find((r) => r.id === selectedRackId) || activeRacks[0] || null;
  }, [activeRacks, selectedRackId]);

  const activeShelves = useMemo(() => {
    return activeRack?.shelves || [];
  }, [activeRack]);

  const activeShelf = useMemo(() => {
    return activeShelves.find((s) => s.id === selectedShelfId) || activeShelves[0] || null;
  }, [activeShelves, selectedShelfId]);

  const activeBoxes = useMemo(() => {
    return activeShelf?.boxes || [];
  }, [activeShelf]);

  const activeBox = useMemo(() => {
    return activeBoxes.find((b) => b.id === selectedBoxId) || activeBoxes[0] || null;
  }, [activeBoxes, selectedBoxId]);

  // Sync state on open or item change
  useEffect(() => {
    if (!isOpen || !item) return;
    const whId = currentAllocation?.warehouseId || warehouses?.[0]?.id || 'WH-001';
    setSelectedWhId(whId);

    const wh = (warehouses || []).find((w) => w.id === whId) || (warehouses || [])[0];
    const fls = wh?.layout?.floors || [];
    const fl = fls.find((f) => f.id === currentAllocation?.floorId) || fls[0];
    setSelectedFloorId(fl?.id || '');

    const rks = fl?.racks || [];
    const rk = rks.find((r) => r.id === currentAllocation?.rackId) || rks[0];
    setSelectedRackId(rk?.id || '');

    const shs = rk?.shelves || [];
    const sh = shs.find((s) => s.id === currentAllocation?.shelfId) || shs[0];
    setSelectedShelfId(sh?.id || '');

    const bxs = sh?.boxes || [];
    const bx = bxs.find((b) => b.id === currentAllocation?.boxId) || bxs[0];
    setSelectedBoxId(bx?.id || '');
  }, [isOpen, item, currentAllocation, warehouses]);

  if (!isOpen || !item) return null;

  const handleWhChange = (e) => {
    const nextWhId = e.target.value;
    setSelectedWhId(nextWhId);
    const wh = (warehouses || []).find((w) => w.id === nextWhId) || (warehouses || [])[0];
    const fl = wh?.layout?.floors?.[0];
    setSelectedFloorId(fl?.id || '');
    const rk = fl?.racks?.[0];
    setSelectedRackId(rk?.id || '');
    const sh = rk?.shelves?.[0];
    setSelectedShelfId(sh?.id || '');
    const bx = sh?.boxes?.[0];
    setSelectedBoxId(bx?.id || '');
  };

  const handleFloorChange = (e) => {
    const nextFlId = e.target.value;
    setSelectedFloorId(nextFlId);
    const fl = activeFloors.find((f) => f.id === nextFlId);
    const rk = fl?.racks?.[0];
    setSelectedRackId(rk?.id || '');
    const sh = rk?.shelves?.[0];
    setSelectedShelfId(sh?.id || '');
    const bx = sh?.boxes?.[0];
    setSelectedBoxId(bx?.id || '');
  };

  const handleRackChange = (e) => {
    const nextRkId = e.target.value;
    setSelectedRackId(nextRkId);
    const rk = activeRacks.find((r) => r.id === nextRkId);
    const sh = rk?.shelves?.[0];
    setSelectedShelfId(sh?.id || '');
    const bx = sh?.boxes?.[0];
    setSelectedBoxId(bx?.id || '');
  };

  const handleShelfChange = (e) => {
    const nextShId = e.target.value;
    setSelectedShelfId(nextShId);
    const sh = activeShelves.find((s) => s.id === nextShId);
    const bx = sh?.boxes?.[0];
    setSelectedBoxId(bx?.id || '');
  };

  const handleAutoDetect = () => {
    if (!activeWh) return;
    const autoAlloc = computeDefaultAllocation(item, activeWh);
    setSelectedFloorId(autoAlloc.floorId || '');
    setSelectedRackId(autoAlloc.rackId || '');
    setSelectedShelfId(autoAlloc.shelfId || '');
    setSelectedBoxId(autoAlloc.boxId || '');
  };

  const handleApply = () => {
    const whId = activeWh?.id || 'WH-001';
    const whName = activeWh?.name || 'Main Central Hub';
    const flName = activeFloor?.name || 'Floor 1';
    const rkName = activeRack?.name || 'Rack A';
    const shName = activeShelf?.name || 'Shelf 1';
    const bxName = activeBox?.name || 'Box 01';
    const bxCode = activeBox?.code || 'BX-01';

    const locationCode = `${activeWh?.code || whId}-${activeFloor?.code || 'FL-01'}-${activeRack?.code || 'RK-A'}-${activeShelf?.code || 'SH-01'}-${bxCode}`;
    const binLocation = `${whName} › ${flName} › ${rkName} › ${shName} › ${bxName}`;

    onSave({
      warehouseId: whId,
      warehouseName: whName,
      floorId: activeFloor?.id || 'FL-01',
      floorName: flName,
      rackId: activeRack?.id || 'RK-A',
      rackName: rkName,
      shelfId: activeShelf?.id || 'SH-01',
      shelfName: shName,
      boxId: activeBox?.id || 'BX-01',
      boxName: bxName,
      boxCode: bxCode,
      locationCode,
      binLocation
    });
    onClose();
  };

  const computedLocCode = activeBox?.code
    ? `${activeWh?.code || activeWh?.id || 'WH-CHN-01'}-${activeFloor?.code || 'FL-01'}-${activeRack?.code || 'RK-A'}-${activeShelf?.code || 'SH-01'}-${activeBox.code}`
    : `${activeWh?.id || 'WH-001'}-${activeBox?.id || 'BX-01'}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '640px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>
                Allocate Physical Storage Bin
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Designate facility putaway coordinates for incoming goods
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Details Header */}
        <div style={{ padding: '12px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>{item.productName || item.name}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
              SKU: {item.productCode || item.code || 'SKU'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoDetect}
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #93c5fd',
              background: '#eff6ff',
              color: '#1d4ed8',
              cursor: 'pointer'
            }}
            title="Auto-match based on category and catalog SKU"
          >
            ⚡ Auto-Detect Best Bin
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Warehouse */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              1. Receiving Warehouse / Hub *
            </label>
            <select
              value={selectedWhId}
              onChange={handleWhChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a'
              }}
            >
              {(warehouses || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? '★ (Default Central Hub)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Floor */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                2. Storage Floor *
              </label>
              <select
                value={selectedFloorId}
                onChange={handleFloorChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 600
                }}
              >
                {activeFloors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Rack */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                3. Rack Bay / Aisle *
              </label>
              <select
                value={selectedRackId}
                onChange={handleRackChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 600
                }}
              >
                {activeRacks.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Shelf */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                4. Shelf Level / Tier *
              </label>
              <select
                value={selectedShelfId}
                onChange={handleShelfChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  fontWeight: 600
                }}
              >
                {activeShelves.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Box */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                5. Storage Box / Bin *
              </label>
              <select
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid #2563eb',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#1e3a8a'
                }}
              >
                {activeBoxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} [{b.code}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Location Preview */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              marginTop: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
              <Check size={14} /> Putaway Location Path Preview
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '4px', lineHeight: 1.4 }}>
              {activeWh?.name} › {activeFloor?.name} › {activeRack?.name} › {activeShelf?.name} › {activeBox?.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#475569' }}>
              <span>Location Code:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px' }}>
                {computedLocCode}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={handleApply}
            style={{ background: '#2563eb', borderColor: '#1d4ed8' }}
          >
            <Check size={16} /> Apply Bin Allocation
          </button>
        </div>
      </div>
    </div>
  );
}
