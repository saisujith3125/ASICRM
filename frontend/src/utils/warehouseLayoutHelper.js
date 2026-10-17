/**
 * warehouseLayoutHelper.js (Frontend)
 * Medical-store / pharmacy style hierarchical warehouse bin layout:
 * Warehouse -> Floor -> Rack -> Shelf -> Box / Bin
 */

export function createDefaultLayout(warehouseName = 'Central Warehouse', codePrefix = 'WH') {
  return {
    floors: [
      {
        id: 'FL-01',
        name: 'Floor 1 (Ground Floor)',
        code: 'FL-01',
        racks: [
          {
            id: 'RK-A',
            name: 'Rack A (CCTV & Surveillance)',
            code: 'RK-A',
            shelves: [
              {
                id: 'SH-01',
                name: 'Shelf 1 (Bottom Tier)',
                code: 'SH-01',
                boxes: [
                  { id: 'BX-A1-01', name: 'Box A1-01 (Bullet Cameras)', code: 'BX-01', desc: 'Standard 2MP/5MP bullet cameras' },
                  { id: 'BX-A1-02', name: 'Box A1-02 (Dome Cameras)', code: 'BX-02', desc: 'Indoor/Outdoor dome cameras' },
                  { id: 'BX-A1-03', name: 'Box A1-03 (PTZ Accessories)', code: 'BX-03', desc: 'Mounts, adaptors & power supplies' }
                ]
              },
              {
                id: 'SH-02',
                name: 'Shelf 2 (Mid Level Tier)',
                code: 'SH-02',
                boxes: [
                  { id: 'BX-A2-01', name: 'Box A2-01 (IP Network Cameras)', code: 'BX-04', desc: 'High-definition POE cameras' },
                  { id: 'BX-A2-02', name: 'Box A2-02 (Junction Boxes & Connectors)', code: 'BX-05', desc: 'Waterproof connectors and fittings' }
                ]
              },
              {
                id: 'SH-03',
                name: 'Shelf 3 (Upper Tier)',
                code: 'SH-03',
                boxes: [
                  { id: 'BX-A3-01', name: 'Box A3-01 (Sensors & Specialized Lenses)', code: 'BX-06', desc: 'Varifocal lenses and sensors' }
                ]
              }
            ]
          },
          {
            id: 'RK-B',
            name: 'Rack B (Storage & Recorders)',
            code: 'RK-B',
            shelves: [
              {
                id: 'SH-01',
                name: 'Shelf 1',
                code: 'SH-01',
                boxes: [
                  { id: 'BX-B1-01', name: 'Box B1-01 (4CH / 8CH DVRs)', code: 'BX-07', desc: 'Compact analog HD recorders' },
                  { id: 'BX-B1-02', name: 'Box B1-02 (16CH / 32CH NVRs)', code: 'BX-08', desc: 'Network video recorder chassis' }
                ]
              },
              {
                id: 'SH-02',
                name: 'Shelf 2',
                code: 'SH-02',
                boxes: [
                  { id: 'BX-B2-01', name: 'Box B2-01 (Surveillance HDDs 1TB-4TB)', code: 'BX-09', desc: 'WD Purple / Seagate Skyhawk drives' },
                  { id: 'BX-B2-02', name: 'Box B2-02 (Enterprise HDDs 6TB-10TB)', code: 'BX-10', desc: 'High-capacity RAID enterprise drives' }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'FL-02',
        name: 'Floor 2 (High-Value Storage)',
        code: 'FL-02',
        racks: [
          {
            id: 'RK-C',
            name: 'Rack C (Biometrics & Access Control)',
            code: 'RK-C',
            shelves: [
              {
                id: 'SH-01',
                name: 'Shelf 1',
                code: 'SH-01',
                boxes: [
                  { id: 'BX-C1-01', name: 'Box C1-01 (Fingerprint & Facial Terminals)', code: 'BX-11', desc: 'Time attendance & biometric scanners' },
                  { id: 'BX-C1-02', name: 'Box C1-02 (EM Locks & Exit Switches)', code: 'BX-12', desc: 'Magnetic locks, brackets, power supplies' }
                ]
              },
              {
                id: 'SH-02',
                name: 'Shelf 2',
                code: 'SH-02',
                boxes: [
                  { id: 'BX-C2-01', name: 'Box C2-01 (RFID Cards & Keyfobs)', code: 'BX-13', desc: 'Smart cards, tokens & tags' }
                ]
              }
            ]
          },
          {
            id: 'RK-D',
            name: 'Rack D (Networking & Switches)',
            code: 'RK-D',
            shelves: [
              {
                id: 'SH-01',
                name: 'Shelf 1',
                code: 'SH-01',
                boxes: [
                  { id: 'BX-D1-01', name: 'Box D1-01 (4-Port / 8-Port POE Switches)', code: 'BX-14', desc: 'Standard network switches' },
                  { id: 'BX-D1-02', name: 'Box D1-02 (16-Port / 24-Port Managed Switches)', code: 'BX-15', desc: 'Gigabit rackmount switches' }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

export function normalizeWarehouseLayout(wh) {
  if (!wh) return null;
  const clone = { ...wh };
  if (!clone.layout || !Array.isArray(clone.layout.floors) || clone.layout.floors.length === 0) {
    clone.layout = createDefaultLayout(clone.name, clone.code);
  }

  clone.layout.floors = clone.layout.floors.map((fl, fIdx) => {
    const fId = fl.id || `FL-${String(fIdx + 1).padStart(2, '0')}`;
    const fName = fl.name || `Floor ${fIdx + 1}`;
    const fCode = fl.code || `FL-${fIdx + 1}`;
    const racks = (Array.isArray(fl.racks) ? fl.racks : []).map((rk, rIdx) => {
      const rackLetter = String.fromCharCode(65 + (rIdx % 26));
      const rId = rk.id || `RK-${rackLetter}`;
      const rName = rk.name || `Rack ${rackLetter}`;
      const rCode = rk.code || `RK-${rackLetter}`;
      const shelves = (Array.isArray(rk.shelves) ? rk.shelves : []).map((sh, sIdx) => {
        const sId = sh.id || `SH-${String(sIdx + 1).padStart(2, '0')}`;
        const sName = sh.name || `Shelf ${sIdx + 1}`;
        const sCode = sh.code || `SH-${sIdx + 1}`;
        const boxes = (Array.isArray(sh.boxes) ? sh.boxes : []).map((b, bIdx) => {
          if (typeof b === 'string') {
            return {
              id: `BX-${rackLetter}${sIdx + 1}-${String(bIdx + 1).padStart(2, '0')}`,
              name: b,
              code: `BX-${String(bIdx + 1).padStart(2, '0')}`
            };
          }
          return {
            id: b.id || `BX-${rackLetter}${sIdx + 1}-${String(bIdx + 1).padStart(2, '0')}`,
            name: b.name || `Box ${bIdx + 1}`,
            code: b.code || `BX-${String(bIdx + 1).padStart(2, '0')}`,
            desc: b.desc || ''
          };
        });
        return { ...sh, id: sId, name: sName, code: sCode, boxes };
      });
      return { ...rk, id: rId, name: rName, code: rCode, shelves };
    });
    return { ...fl, id: fId, name: fName, code: fCode, racks };
  });

  return clone;
}

export function countWarehouseBins(wh) {
  if (!wh || !wh.layout || !Array.isArray(wh.layout.floors)) {
    return { floors: 0, racks: 0, shelves: 0, boxes: 0 };
  }
  let floors = wh.layout.floors.length;
  let racks = 0;
  let shelves = 0;
  let boxes = 0;

  wh.layout.floors.forEach((fl) => {
    if (Array.isArray(fl.racks)) {
      racks += fl.racks.length;
      fl.racks.forEach((rk) => {
        if (Array.isArray(rk.shelves)) {
          shelves += rk.shelves.length;
          rk.shelves.forEach((sh) => {
            if (Array.isArray(sh.boxes)) {
              boxes += sh.boxes.length;
            }
          });
        }
      });
    }
  });

  return { floors, racks, shelves, boxes };
}

export function formatLocationString({ warehouseName, floor, rack, shelf, box }) {
  const segments = [warehouseName, floor, rack, shelf, box].filter(Boolean);
  return segments.join(' › ');
}

export function formatLocationCode({ warehouseCode, floorCode, rackCode, shelfCode, boxCode }) {
  const segments = [warehouseCode, floorCode, rackCode, shelfCode, boxCode].filter(Boolean);
  return segments.join('-');
}
