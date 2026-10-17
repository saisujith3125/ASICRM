import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import {
  normalizeWarehouseLayout,
  formatLocationString,
  formatLocationCode
} from '../../utils/warehouseLayoutHelper';

const MOVEMENT_TYPES = [
  { id: 'STOCK IN', label: 'STOCK IN', description: 'Receipt of stock from supplier, purchase, or initial count' },
  { id: 'STOCK OUT', label: 'STOCK OUT', description: 'Dispatch to customer, damage, sample, or usage' },
  { id: 'RETURN', label: 'RETURN', description: 'Goods returned by customer or branch' },
  { id: 'ADJUSTMENT', label: 'ADJUSTMENT', description: 'Correction for inventory audit or reconciliation' },
  { id: 'TRANSFER', label: 'TRANSFER', description: 'Relocation between warehouses or departments' },
];

export default function NewStockMovementModal({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  initialProductId = '',
  initialType = 'STOCK IN',
  user
}) {
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || (products[0]?.id || ''));
  const [movementType, setMovementType] = useState(initialType || 'STOCK IN');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [source, setSource] = useState('Main Warehouse');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustmentDirection, setAdjustmentDirection] = useState('add'); // 'add' or 'subtract'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stockInSerialsText, setStockInSerialsText] = useState('');
  const [isGeneratingSerials, setIsGeneratingSerials] = useState(false);

  // Warehouse Hierarchical Storage Bin State (Medical Store Logic: Floor -> Rack -> Shelf -> Box)
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedRackId, setSelectedRackId] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [useFreeformLocation, setUseFreeformLocation] = useState(false);

  // Master Location Search across warehouse hierarchy
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Box / Bin specific search & filter state
  const [boxSearchQuery, setBoxSearchQuery] = useState('');
  const [showBoxDropdown, setShowBoxDropdown] = useState(false);
  const [boxPickerMode, setBoxPickerMode] = useState('search'); // 'search' (interactive search type) or 'select' (standard dropdown)

  // Transfer specific: Source warehouse hierarchy
  const [transferSourceWhId, setTransferSourceWhId] = useState('');
  const [transferSourceFloorId, setTransferSourceFloorId] = useState('');
  const [transferSourceRackId, setTransferSourceRackId] = useState('');
  const [transferSourceShelfId, setTransferSourceShelfId] = useState('');
  const [transferSourceBoxId, setTransferSourceBoxId] = useState('');

  // Fetch warehouses from Settings API when modal opens
  useEffect(() => {
    if (!isOpen) return;
    apiFetch(apiUrl('/api/settings/company'))
      .then((r) => r.json())
      .then((d) => {
        const rawWhs = d.data?.warehouses || d.companySettings?.warehouses || [];
        const normalized = rawWhs.map(normalizeWarehouseLayout);
        if (normalized.length > 0) {
          setWarehouses(normalized);
          const defaultWh = normalized.find((w) => w.isDefault) || normalized[0];
          setSelectedWarehouseId(defaultWh.id);
          const fl = defaultWh.layout?.floors?.[0];
          if (fl) {
            setSelectedFloorId(fl.id);
            const rk = fl.racks?.[0];
            if (rk) {
              setSelectedRackId(rk.id);
              const sh = rk.shelves?.[0];
              if (sh) {
                setSelectedShelfId(sh.id);
                const bx = sh.boxes?.[0];
                if (bx) setSelectedBoxId(typeof bx === 'string' ? bx : bx.id);
              }
            }
          }

          // Transfer source defaults to second warehouse or first
          const srcWh = normalized.length > 1 ? normalized[1] : normalized[0];
          setTransferSourceWhId(srcWh.id);
          const sFl = srcWh.layout?.floors?.[0];
          if (sFl) {
            setTransferSourceFloorId(sFl.id);
            const sRk = sFl.racks?.[0];
            if (sRk) {
              setTransferSourceRackId(sRk.id);
              const sSh = sRk.shelves?.[0];
              if (sSh) {
                setTransferSourceShelfId(sSh.id);
                const sBx = sSh.boxes?.[0];
                if (sBx) setTransferSourceBoxId(typeof sBx === 'string' ? sBx : sBx.id);
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching warehouses for stock movement modal:', err);
      });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialProductId) {
        setSelectedProductId(initialProductId);
      } else if (products.length > 0 && !selectedProductId) {
        setSelectedProductId(products[0].id);
      }
      if (initialType) {
        setMovementType(initialType);
      }
      setQuantity('');
      setReference('');
      setReason('');
      setNotes('');
      setStockInSerialsText('');
      setError('');
      if (initialType === 'TRANSFER') {
        setSource('Main Central Hub');
        setDestination('North Chennai Transit Godown');
      } else if (initialType === 'STOCK IN') {
        setSource('Inward / Supplier');
        setDestination('Main Central Hub');
      } else if (initialType === 'STOCK OUT') {
        setSource('Main Central Hub');
        setDestination('Dispatch / Customer');
      }
    }
  }, [isOpen, initialProductId, initialType, products]);

  // Active warehouse layout hierarchy objects
  const activeWh = useMemo(() => {
    return warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];
  }, [warehouses, selectedWarehouseId]);

  const activeFloors = useMemo(() => activeWh?.layout?.floors || [], [activeWh]);
  const activeFloor = useMemo(() => {
    return activeFloors.find((f) => f.id === selectedFloorId) || activeFloors[0];
  }, [activeFloors, selectedFloorId]);

  const activeRacks = useMemo(() => activeFloor?.racks || [], [activeFloor]);
  const activeRack = useMemo(() => {
    return activeRacks.find((r) => r.id === selectedRackId) || activeRacks[0];
  }, [activeRacks, selectedRackId]);

  const activeShelves = useMemo(() => activeRack?.shelves || [], [activeRack]);
  const activeShelf = useMemo(() => {
    return activeShelves.find((s) => s.id === selectedShelfId) || activeShelves[0];
  }, [activeShelves, selectedShelfId]);

  const activeBoxes = useMemo(() => activeShelf?.boxes || [], [activeShelf]);
  const activeBox = useMemo(() => {
    return activeBoxes.find((b) => (typeof b === 'string' ? b : b.id) === selectedBoxId) || activeBoxes[0];
  }, [activeBoxes, selectedBoxId]);

  // Formatted destination picking location path & code
  const activeBoxName = typeof activeBox === 'string' ? activeBox : (activeBox?.name || 'Box 01');
  const activeBoxCode = typeof activeBox === 'string' ? activeBox : (activeBox?.code || 'BX-01');

  const formattedPickingPath = useMemo(() => {
    if (!activeWh) return 'Main Warehouse';
    return formatLocationString({
      warehouseName: activeWh.name,
      floor: activeFloor?.name,
      rack: activeRack?.name,
      shelf: activeShelf?.name,
      box: activeBoxName
    });
  }, [activeWh, activeFloor, activeRack, activeShelf, activeBoxName]);

  const formattedLocationCode = useMemo(() => {
    if (!activeWh) return '';
    return formatLocationCode({
      warehouseCode: activeWh.code,
      floorCode: activeFloor?.code,
      rackCode: activeRack?.code,
      shelfCode: activeShelf?.code,
      boxCode: activeBoxCode
    });
  }, [activeWh, activeFloor, activeRack, activeShelf, activeBoxCode]);

  // Comprehensive searchable flat index across all warehouse storage coordinates
  const allWarehouseLocations = useMemo(() => {
    if (!activeWh?.layout?.floors) return [];
    const list = [];
    activeWh.layout.floors.forEach((fl) => {
      (fl.racks || []).forEach((rk) => {
        (rk.shelves || []).forEach((sh) => {
          (sh.boxes || []).forEach((bx, bIdx) => {
            const bId = typeof bx === 'string' ? bx : (bx.id || `bx-${bIdx}`);
            const bName = typeof bx === 'string' ? bx : bx.name;
            const bCode = typeof bx === 'string' ? '' : (bx.code || '');
            const bDesc = typeof bx === 'string' ? '' : (bx.desc || '');
            const fullPath = `${fl.name} ➔ ${rk.name} ➔ ${sh.name} ➔ ${bName}`;
            const coordCode = [activeWh.code, fl.code, rk.code, sh.code, bCode].filter(Boolean).join('-');
            list.push({
              floorId: fl.id,
              floorName: fl.name,
              floorCode: fl.code,
              rackId: rk.id,
              rackName: rk.name,
              rackCode: rk.code,
              shelfId: sh.id,
              shelfName: sh.name,
              shelfCode: sh.code,
              boxId: bId,
              boxName: bName,
              boxCode: bCode,
              boxDesc: bDesc,
              fullPath,
              coordCode,
              searchText: `${fl.name} ${fl.code} ${rk.name} ${rk.code} ${sh.name} ${sh.code} ${bName} ${bCode} ${bDesc} ${coordCode}`.toLowerCase()
            });
          });
        });
      });
    });
    return list;
  }, [activeWh]);

  // Filtered locations for the Master Location Search Box
  const filteredLocations = useMemo(() => {
    if (!locationSearchQuery.trim()) return [];
    const q = locationSearchQuery.trim().toLowerCase();
    return allWarehouseLocations.filter((loc) => loc.searchText.includes(q)).slice(0, 10);
  }, [allWarehouseLocations, locationSearchQuery]);

  // Filtered boxes on the currently active shelf for "4. Box / Bin" Search Type
  const filteredShelfBoxes = useMemo(() => {
    if (!boxSearchQuery.trim()) return activeBoxes;
    const q = boxSearchQuery.trim().toLowerCase();
    return activeBoxes.filter((bx) => {
      const bName = typeof bx === 'string' ? bx : bx.name;
      const bCode = typeof bx === 'string' ? '' : (bx.code || '');
      const bDesc = typeof bx === 'string' ? '' : (bx.desc || '');
      return `${bName} ${bCode} ${bDesc}`.toLowerCase().includes(q);
    });
  }, [activeBoxes, boxSearchQuery]);

  // 1-Click Auto Select handler for Master Location Search
  const handleSelectLocation = (loc) => {
    setSelectedFloorId(loc.floorId);
    setSelectedRackId(loc.rackId);
    setSelectedShelfId(loc.shelfId);
    setSelectedBoxId(loc.boxId);
    setLocationSearchQuery('');
    setShowLocationDropdown(false);
    setBoxSearchQuery('');
    setShowBoxDropdown(false);
  };

  // Automatically synchronize destination (or source for STOCK OUT) with the hierarchical picking location
  useEffect(() => {
    if (useFreeformLocation) return;
    if (movementType === 'STOCK IN' || movementType === 'RETURN' || movementType === 'ADJUSTMENT' || movementType === 'TRANSFER') {
      if (formattedPickingPath) {
        setDestination(formattedPickingPath);
      }
    } else if (movementType === 'STOCK OUT') {
      if (formattedPickingPath) {
        setSource(formattedPickingPath);
      }
    }
  }, [formattedPickingPath, movementType, useFreeformLocation]);

  // Handle warehouse changes and cascade downwards
  const handleWarehouseChange = (whId) => {
    setSelectedWarehouseId(whId);
    setLocationSearchQuery('');
    setShowLocationDropdown(false);
    setBoxSearchQuery('');
    setShowBoxDropdown(false);
    const wh = warehouses.find((w) => w.id === whId);
    const fl = wh?.layout?.floors?.[0];
    if (fl) {
      setSelectedFloorId(fl.id);
      const rk = fl.racks?.[0];
      if (rk) {
        setSelectedRackId(rk.id);
        const sh = rk.shelves?.[0];
        if (sh) {
          setSelectedShelfId(sh.id);
          const bx = sh.boxes?.[0];
          if (bx) setSelectedBoxId(typeof bx === 'string' ? bx : bx.id);
        }
      }
    }
  };

  const handleFloorChange = (fId) => {
    setSelectedFloorId(fId);
    setBoxSearchQuery('');
    setShowBoxDropdown(false);
    const fl = activeFloors.find((f) => f.id === fId);
    const rk = fl?.racks?.[0];
    if (rk) {
      setSelectedRackId(rk.id);
      const sh = rk.shelves?.[0];
      if (sh) {
        setSelectedShelfId(sh.id);
        const bx = sh.boxes?.[0];
        if (bx) setSelectedBoxId(typeof bx === 'string' ? bx : bx.id);
      }
    }
  };

  const handleRackChange = (rId) => {
    setSelectedRackId(rId);
    setBoxSearchQuery('');
    setShowBoxDropdown(false);
    const rk = activeRacks.find((r) => r.id === rId);
    const sh = rk?.shelves?.[0];
    if (sh) {
      setSelectedShelfId(sh.id);
      const bx = sh.boxes?.[0];
      if (bx) setSelectedBoxId(typeof bx === 'string' ? bx : bx.id);
    }
  };

  const handleShelfChange = (sId) => {
    setSelectedShelfId(sId);
    setBoxSearchQuery('');
    setShowBoxDropdown(false);
    const sh = activeShelves.find((s) => s.id === sId);
    const bx = sh?.boxes?.[0];
    if (bx) setSelectedBoxId(typeof bx === 'string' ? bx : bx.id);
  };

  // Update default source/destination when movement type changes
  const handleTypeChange = (newType) => {
    setMovementType(newType);
    setError('');
    if (newType === 'STOCK IN') {
      setSource('Inward / Supplier');
      setDestination(formattedPickingPath || 'Main Central Hub');
    } else if (newType === 'STOCK OUT') {
      setSource(formattedPickingPath || 'Main Central Hub');
      setDestination('Dispatch / Customer');
    } else if (newType === 'RETURN') {
      setSource('Customer Return');
      setDestination(formattedPickingPath || 'Main Central Hub');
    } else if (newType === 'TRANSFER') {
      setSource('Main Central Hub (Floor 1)');
      setDestination(formattedPickingPath || 'Secondary Hub');
    } else if (newType === 'ADJUSTMENT') {
      setSource('Physical Count Audit');
      setDestination(formattedPickingPath || 'Main Central Hub');
    }
  };

  const selectedProduct = useMemo(() => {
    return products.find(
      (p) => String(p.id) === String(selectedProductId) || String(p.code) === String(selectedProductId)
    );
  }, [products, selectedProductId]);

  const isCable = useMemo(() => {
    if (!selectedProduct) return false;
    const catId = String(selectedProduct.categoryId || '').toUpperCase();
    if (catId === 'CAT-000004') return true;
    const catName = String(selectedProduct.categoryName || selectedProduct.category || '').toLowerCase();
    if (/cable/i.test(catName)) return true;
    const prodName = String(selectedProduct.name || '').toLowerCase();
    if (/\bcables?\b/i.test(prodName) || /cat\s*6\s*cable/i.test(prodName) || /utp\s*cable/i.test(prodName) || /patch\s*cord/i.test(prodName) || /fiber\s*cable/i.test(prodName)) {
      return true;
    }
    const unit = String(selectedProduct.unit || '').trim();
    if ((unit === 'Meter' || unit === 'Roll') && /cable|wire/i.test(prodName)) return true;
    return false;
  }, [selectedProduct]);

  const isSerializedProduct = Boolean(!isCable && selectedProduct && selectedProduct.serialized !== false);

  const parsedStockInSerials = useMemo(() => {
    if (!stockInSerialsText) return [];
    return stockInSerialsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [stockInSerialsText]);

  const handleAutoGenerateStockInSerials = async () => {
    if (!selectedProduct || !numQty || numQty <= 0) return;
    setIsGeneratingSerials(true);
    try {
      const res = await apiFetch(apiUrl(`/api/stocks/products/${encodeURIComponent(selectedProduct.id)}/generate-serials?qty=${numQty}`));
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.serialNumbers) && data.serialNumbers.length > 0) {
        setStockInSerialsText(data.serialNumbers.join('\n'));
      } else {
        const code = String(selectedProduct.code || 'PROD').trim().toUpperCase();
        const start = 1001 + (Number(selectedProduct.stock) || 0);
        const generated = Array.from({ length: numQty }, (_, i) => `${code}-SN-${start + i}`);
        setStockInSerialsText(generated.join('\n'));
      }
    } catch {
      const code = String(selectedProduct.code || 'PROD').trim().toUpperCase();
      const start = 1001 + (Number(selectedProduct.stock) || 0);
      const generated = Array.from({ length: numQty }, (_, i) => `${code}-SN-${start + i}`);
      setStockInSerialsText(generated.join('\n'));
    } finally {
      setIsGeneratingSerials(false);
    }
  };

  const currentStock = Number(selectedProduct?.totalStock ?? selectedProduct?.stock ?? 0);
  const reservedStock = Number(selectedProduct?.reservedStock ?? 0);
  const availableStock = Math.max(0, currentStock - reservedStock);

  // Live calculation preview
  const numQty = parseFloat(quantity) || 0;
  let effectiveDelta = 0;
  if (movementType === 'STOCK IN' || movementType === 'RETURN') {
    effectiveDelta = Math.abs(numQty);
  } else if (movementType === 'STOCK OUT') {
    effectiveDelta = -Math.abs(numQty);
  } else if (movementType === 'ADJUSTMENT') {
    effectiveDelta = adjustmentDirection === 'subtract' ? -Math.abs(numQty) : Math.abs(numQty);
  } else if (movementType === 'TRANSFER') {
    effectiveDelta = 0; // internal transfer
  }

  const projectedTotalStock = Math.max(0, currentStock + effectiveDelta);
  const projectedAvailableStock = Math.max(0, projectedTotalStock - reservedStock);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedProduct) {
      setError('Please select a valid product.');
      return;
    }

    if (!numQty || numQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (!Number.isInteger(numQty)) {
      setError('Quantity must be a whole number (integer).');
      return;
    }

    if (movementType === 'STOCK OUT' && numQty > availableStock) {
      setError(`Cannot deduct ${numQty} units. Only ${availableStock} units are currently available in stock.`);
      return;
    }

    if (movementType === 'TRANSFER') {
      if (!source.trim() || !destination.trim()) {
        setError('Both Source and Destination locations are required for transfer.');
        return;
      }
      if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
        setError('Source and Destination locations cannot be identical.');
        return;
      }
    }

    if (movementType === 'ADJUSTMENT' && !reason.trim()) {
      setError('Reason is mandatory for stock adjustment.');
      return;
    }

    let stockInSerials = [];
    if (movementType === 'STOCK IN' && isSerializedProduct) {
      if (parsedStockInSerials.length === numQty) {
        const seen = new Set();
        for (const sn of parsedStockInSerials) {
          const snUpper = sn.toUpperCase();
          if (seen.has(snUpper)) {
            setError(`Duplicate serial number "${sn}" entered. All serial numbers must be unique.`);
            return;
          }
          seen.add(snUpper);
        }
        stockInSerials = parsedStockInSerials;
      } else if (parsedStockInSerials.length === 0) {
        // Automatically computer-generate serial numbers if left empty
        const code = String(selectedProduct.code || 'PROD').trim().toUpperCase();
        const start = 1001 + (Number(selectedProduct.stock) || 0);
        stockInSerials = Array.from({ length: numQty }, (_, i) => `${code}-SN-${start + i}`);
      } else {
        setError(`Product "${selectedProduct.name}" is serialized and requires exactly ${numQty} serial number(s) for STOCK IN (currently entered: ${parsedStockInSerials.length}).`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        productId: selectedProduct.id,
        type: movementType,
        quantity: movementType === 'ADJUSTMENT' ? effectiveDelta : numQty,
        unit: (selectedProduct.unit && selectedProduct.unit !== 'Piece') ? selectedProduct.unit : 'Nos',
        reference: reference.trim(),
        source: source.trim(),
        destination: destination.trim(),
        reason: reason.trim(),
        notes: notes.trim(),
        isExternalDispatch: false,
        serialNumbers: stockInSerials,
        // Connected Medical Store Storage Hierarchy Fields
        warehouseId: activeWh?.id || null,
        warehouseName: activeWh?.name || null,
        floor: activeFloor?.name || null,
        rack: activeRack?.name || null,
        shelf: activeShelf?.name || null,
        box: activeBoxName || null,
        binLocation: formattedPickingPath,
        locationCode: formattedLocationCode
      };

      const res = await apiFetch(apiUrl('/api/stocks/movements'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'USR-001',
          'x-user-name': user?.name || user?.username || 'User'
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to record stock movement.');
      }

      if (onSuccess) onSuccess(json.movement || json);
      onClose();
    } catch (err) {
      console.error('Error recording stock movement:', err);
      setError(err.message || 'An error occurred while recording stock movement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-backdrop crm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="stock-movement-title">
      <div
        className="crm-modal-card crm-modal-content stock-modal-card-v3"
        data-movement-type={movementType}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '740px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          className="crm-modal-header"
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <div>
            <h3 id="stock-movement-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              New Stock Entry
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Record physical inventory transaction and update live stock balances.
            </p>
          </div>
          <button
            type="button"
            className="crm-modal-close"
            onClick={onClose}
            aria-label="Close modal"
            style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
          <div className="crm-modal-body" style={{ padding: '18px 22px', flex: '1 1 auto', overflowY: 'auto', maxHeight: 'none' }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Product Selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Product <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', color: '#0f172a', background: '#fff' }}
              >
                {products.map((p) => {
                  const avail = Math.max(0, Number(p.totalStock ?? p.stock ?? 0) - Number(p.reservedStock ?? 0));
                  return (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} (Total: {p.totalStock ?? p.stock ?? 0}, Avail: {avail} {(p.unit && p.unit !== 'Piece') ? p.unit : 'Nos'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Movement Type Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Movement Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                {MOVEMENT_TYPES.map((t) => {
                  const isSelected = movementType === t.id;
                  let activeBg = '#eff6ff';
                  let activeBorder = '#2563eb';
                  let activeText = '#1d4ed8';
                  if (t.id === 'STOCK OUT') {
                    activeBg = '#fef2f2'; activeBorder = '#dc2626'; activeText = '#b91c1c';
                  } else if (t.id === 'ADJUSTMENT') {
                    activeBg = '#fffbeb'; activeBorder = '#d97706'; activeText = '#b45309';
                  } else if (t.id === 'TRANSFER') {
                    activeBg = '#f5f3ff'; activeBorder = '#7c3aed'; activeText = '#6d28d9';
                  }

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTypeChange(t.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: isSelected ? `2px solid ${activeBorder}` : '1px solid #cbd5e1',
                        background: isSelected ? activeBg : '#fff',
                        color: isSelected ? activeText : '#475569',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center'
                      }}
                      title={t.description}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity and Direction Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: movementType === 'ADJUSTMENT' ? '120px 1fr 100px' : '1fr 100px', gap: '12px', marginBottom: '14px' }}>
              {movementType === 'ADJUSTMENT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Direction
                  </label>
                  <select
                    value={adjustmentDirection}
                    onChange={(e) => setAdjustmentDirection(e.target.value)}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="add">+ Add</option>
                    <option value="subtract">- Deduct</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Quantity <span style={{ color: '#ef4444' }}>*</span>
                  {movementType === 'STOCK OUT' && (
                    <span style={{ fontWeight: 500, color: '#dc2626', marginLeft: '6px' }}>
                      (Max: {availableStock})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Unit
                </label>
                <input
                  type="text"
                  readOnly
                  value={(selectedProduct?.unit && selectedProduct.unit !== 'Piece') ? selectedProduct.unit : 'Nos'}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 10px', fontSize: '13px', color: '#64748b', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Cable Notice: Serial numbers are NOT allowed for cables */}
            {isCable && (
              <div style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#1e40af'
              }}>
                <span style={{ fontSize: '15px' }}>ℹ️</span>
                <span><strong>Cable Item:</strong> Cables do not require or track serial numbers. Stock is measured by quantity / length.</span>
              </div>
            )}

            {/* Serial Numbers Section for STOCK IN on Serialized Non-Cable Hardware */}
            {movementType === 'STOCK IN' && isSerializedProduct && (
              <div style={{
                marginBottom: '16px',
                padding: '14px 16px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Serial Numbers for Stock In <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: parsedStockInSerials.length === numQty && numQty > 0 ? '#dcfce7' : (parsedStockInSerials.length > numQty ? '#fee2e2' : '#fef3c7'),
                      color: parsedStockInSerials.length === numQty && numQty > 0 ? '#15803d' : (parsedStockInSerials.length > numQty ? '#b91c1c' : '#b45309'),
                      border: `1px solid ${parsedStockInSerials.length === numQty && numQty > 0 ? '#bbf7d0' : (parsedStockInSerials.length > numQty ? '#fecaca' : '#fde68a')}`
                    }}>
                      {parsedStockInSerials.length} / {numQty || 0} {parsedStockInSerials.length === numQty && numQty > 0 ? '✓ Complete' : 'Entered'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoGenerateStockInSerials}
                    disabled={!numQty || numQty <= 0 || isGeneratingSerials}
                    className="crm-btn-secondary compact"
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#eff6ff',
                      borderColor: '#93c5fd',
                      color: '#1d4ed8',
                      cursor: (!numQty || numQty <= 0 || isGeneratingSerials) ? 'not-allowed' : 'pointer',
                      opacity: (!numQty || numQty <= 0) ? 0.6 : 1
                    }}
                    title="Generate unique sequential serial numbers"
                  >
                    ⚡ {isGeneratingSerials ? 'Generating...' : 'Auto-Generate Computer Serials'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>
                  Enter serial numbers manually (one per line or comma-separated) or click <strong>Auto-Generate Computer Serials</strong>.
                </p>
                <textarea
                  rows={4}
                  value={stockInSerialsText}
                  onChange={(e) => setStockInSerialsText(e.target.value)}
                  placeholder={numQty > 0 ? `${selectedProduct?.code || 'ASI-01'}-SN-1001\n${selectedProduct?.code || 'ASI-01'}-SN-1002\n...` : 'Enter quantity above first'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: `1px solid ${parsedStockInSerials.length === numQty && numQty > 0 ? '#16a34a' : '#cbd5e1'}`,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Reference Number */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                Reference Document / PO / Challan
              </label>
              <input
                type="text"
                placeholder="e.g. PO-00045, DC-00089, AUDIT-2026-Q3"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Source & Destination (Dynamic for Transfer, or Location tracking) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Source Location {movementType === 'TRANSFER' && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  type="text"
                  required={movementType === 'TRANSFER'}
                  placeholder="e.g. Inward / Supplier"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                    Destination Location {movementType === 'TRANSFER' && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseFreeformLocation(!useFreeformLocation)}
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '10.5px', cursor: 'pointer', padding: 0 }}
                  >
                    {useFreeformLocation ? '⚡ Use Storage Bins' : '✏️ Freeform Text'}
                  </button>
                </div>
                <input
                  type="text"
                  required={movementType === 'TRANSFER'}
                  placeholder="e.g. Main Central Hub"
                  value={destination}
                  onChange={(e) => {
                    setUseFreeformLocation(true);
                    setDestination(e.target.value);
                  }}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* MEDICAL STORE SMART WAREHOUSE STORAGE LOCATION PICKER (Floor -> Rack -> Shelf -> Box) */}
            {!useFreeformLocation && (
              <div
                className="medical-store-location-card"
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🏥</span>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        Warehouse Picking Hierarchy (Floor › Rack › Shelf › Box)
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Medical-store style indexing so any team member can pinpoint items instantly.
                      </span>
                    </div>
                  </div>
                  {activeWh && (
                    <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '3px 9px', borderRadius: '5px', fontWeight: 700 }}>
                      Facility: {activeWh.code}
                    </span>
                  )}
                </div>

                {/* Warehouse Facility Dropdown */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Warehouse Facility
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => handleWarehouseChange(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '7px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12.5px', background: '#fff', color: '#0f172a', fontWeight: 500 }}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name} ({w.location}) {w.isDefault ? '★ Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MASTER LOCATION SEARCH BOX (Fast 1-click finder across entire warehouse) */}
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>🔍</span>
                      <span>Quick Search Location / Bin / Box / Item (Auto-fills all 4 levels)</span>
                    </label>
                    {locationSearchQuery && (
                      <button
                        type="button"
                        onClick={() => { setLocationSearchQuery(''); setShowLocationDropdown(false); }}
                        style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={locationSearchQuery}
                      onChange={(e) => {
                        setLocationSearchQuery(e.target.value);
                        setShowLocationDropdown(true);
                      }}
                      onFocus={() => {
                        if (locationSearchQuery.trim()) setShowLocationDropdown(true);
                      }}
                      placeholder="Type box name, item type or rack (e.g. 'Bullet Cameras', 'Box A1', 'Rack A', 'Ground Floor')..."
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 32px 0 12px',
                        borderRadius: '7px',
                        border: '1.5px solid #3b82f6',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(37,99,235,0.08)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {locationSearchQuery && (
                      <button
                        type="button"
                        onClick={() => { setLocationSearchQuery(''); setShowLocationDropdown(false); }}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: '#e2e8f0',
                          color: '#475569',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown (In-Flow for perfect visibility and scroll behavior) */}
                  {showLocationDropdown && locationSearchQuery.trim().length > 0 && (
                    <div
                      style={{
                        position: 'relative',
                        marginTop: '6px',
                        background: '#ffffff',
                        border: '1.5px solid #3b82f6',
                        borderRadius: '8px',
                        boxShadow: '0 4px 14px rgba(37,99,235,0.12)',
                        maxHeight: '220px',
                        overflowY: 'auto'
                      }}
                    >
                      <div style={{ padding: '6px 10px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', fontSize: '11px', fontWeight: 600, color: '#1e40af', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Matching Storage Coordinates ({filteredLocations.length})</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>Click to auto-select</span>
                      </div>
                      {filteredLocations.length === 0 ? (
                        <div style={{ padding: '14px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                          No warehouse location matching "<strong>{locationSearchQuery}</strong>"
                        </div>
                      ) : (
                        filteredLocations.map((loc, idx) => (
                          <div
                            key={`${loc.floorId}-${loc.rackId}-${loc.shelfId}-${loc.boxId}-${idx}`}
                            className="warehouse-search-result-item"
                            data-box-id={loc.boxId}
                            tabIndex={0}
                            onClick={() => handleSelectLocation(loc)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelectLocation(loc);
                              }
                            }}
                            style={{
                              padding: '10px 12px',
                              borderBottom: idx < filteredLocations.length - 1 ? '1px solid #f1f5f9' : 'none',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                              <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>
                                📦 {loc.boxName}
                              </strong>
                              {loc.boxCode && (
                                <span style={{ fontSize: '10px', fontWeight: 700, background: '#ecfdf5', color: '#059669', padding: '1px 6px', borderRadius: '4px' }}>
                                  {loc.boxCode}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#2563eb', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              <span>{loc.floorName}</span>
                              <span>›</span>
                              <span>{loc.rackName}</span>
                              <span>›</span>
                              <span>{loc.shelfName}</span>
                            </div>
                            {loc.boxDesc && (
                              <div style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic' }}>
                                {loc.boxDesc}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 2x2 CASCADING GRID: Floor, Rack, Shelf, Box */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '12px',
                    marginBottom: '14px'
                  }}
                >
                  {/* 1. FLOOR */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span style={{ background: '#2563eb', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>1</span>
                        Floor (Level)
                      </label>
                      {activeFloor?.code && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                          {activeFloor.code}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedFloorId}
                      onChange={(e) => handleFloorChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0 8px',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        background: '#fff',
                        fontWeight: 500,
                        boxSizing: 'border-box'
                      }}
                    >
                      {activeFloors.map((fl) => (
                        <option key={fl.id} value={fl.id}>
                          {fl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. RACK */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span style={{ background: '#2563eb', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>2</span>
                        Rack (Aisle / Section)
                      </label>
                      {activeRack?.code && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                          {activeRack.code}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedRackId}
                      onChange={(e) => handleRackChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0 8px',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        background: '#fff',
                        fontWeight: 500,
                        boxSizing: 'border-box'
                      }}
                    >
                      {activeRacks.map((rk) => (
                        <option key={rk.id} value={rk.id}>
                          {rk.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. SHELF */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span style={{ background: '#2563eb', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>3</span>
                        Shelf (Vertical Tier)
                      </label>
                      {activeShelf?.code && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                          {activeShelf.code}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedShelfId}
                      onChange={(e) => handleShelfChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0 8px',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        background: '#fff',
                        fontWeight: 500,
                        boxSizing: 'border-box'
                      }}
                    >
                      {activeShelves.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. BOX / BIN (SEARCH TYPE & PICK) */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span style={{ background: '#2563eb', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>4</span>
                        Box / Bin (Search &amp; Pick)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {activeBoxCode && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                            {activeBoxCode}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setBoxPickerMode(boxPickerMode === 'search' ? 'select' : 'search')}
                          title={boxPickerMode === 'search' ? 'Switch to simple select' : 'Switch to search input'}
                          style={{
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {boxPickerMode === 'search' ? '📋 List' : '🔍 Search'}
                        </button>
                      </div>
                    </div>

                    {boxPickerMode === 'search' ? (
                      /* SEARCH TYPE BOX PICKER */
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                          <input
                            type="text"
                            value={boxSearchQuery !== '' ? boxSearchQuery : activeBoxName}
                            onChange={(e) => {
                              setBoxSearchQuery(e.target.value);
                              setShowBoxDropdown(true);
                            }}
                            onFocus={() => {
                              setBoxSearchQuery('');
                              setShowBoxDropdown(true);
                            }}
                            placeholder="Type to search box or bin..."
                            style={{
                              width: '100%',
                              height: '36px',
                              borderRadius: '6px',
                              border: showBoxDropdown ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                              padding: '0 28px 0 10px',
                              fontSize: '12px',
                              color: '#0f172a',
                              background: '#fff',
                              fontWeight: 500,
                              boxSizing: 'border-box',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowBoxDropdown(!showBoxDropdown)}
                            style={{
                              position: 'absolute',
                              right: '4px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              border: 'none',
                              background: 'none',
                              color: '#64748b',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            {showBoxDropdown ? '▲' : '▼'}
                          </button>
                        </div>

                        {/* Dropdown list for Box search */}
                        {showBoxDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 9999,
                              marginTop: '3px',
                              background: '#ffffff',
                              border: '1.5px solid #2563eb',
                              borderRadius: '6px',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                              maxHeight: '200px',
                              overflowY: 'auto'
                            }}
                          >
                            {filteredShelfBoxes.length === 0 ? (
                              <div style={{ padding: '10px', fontSize: '11.5px', color: '#64748b', textAlign: 'center' }}>
                                No box matching "{boxSearchQuery}" on this shelf.
                              </div>
                            ) : (
                              filteredShelfBoxes.map((bx, bIdx) => {
                                const bId = typeof bx === 'string' ? bx : (bx.id || `bx-${bIdx}`);
                                const bName = typeof bx === 'string' ? bx : bx.name;
                                const bCode = typeof bx === 'string' ? '' : (bx.code || '');
                                const bDesc = typeof bx === 'string' ? '' : (bx.desc || '');
                                const isSelected = (selectedBoxId === bId || activeBoxName === bName);

                                return (
                                  <div
                                    key={bId}
                                    onClick={() => {
                                      setSelectedBoxId(bId);
                                      setBoxSearchQuery('');
                                      setShowBoxDropdown(false);
                                    }}
                                    style={{
                                      padding: '8px 10px',
                                      borderBottom: bIdx < filteredShelfBoxes.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      background: isSelected ? '#eff6ff' : '#ffffff',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px'
                                    }}
                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                                        {isSelected ? '✓ ' : ''}{bName}
                                      </span>
                                      {bCode && (
                                        <span style={{ fontSize: '10px', fontWeight: 700, background: '#ecfdf5', color: '#059669', padding: '1px 5px', borderRadius: '3px' }}>
                                          {bCode}
                                        </span>
                                      )}
                                    </div>
                                    {bDesc && (
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                                        {bDesc}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* STANDARD SELECT FALLBACK */
                      <select
                        value={selectedBoxId}
                        onChange={(e) => setSelectedBoxId(e.target.value)}
                        style={{
                          width: '100%',
                          height: '36px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          padding: '0 8px',
                          fontSize: '12px',
                          color: '#0f172a',
                          background: '#fff',
                          fontWeight: 500,
                          boxSizing: 'border-box'
                        }}
                      >
                        {activeBoxes.map((bx, bIdx) => {
                          const bId = typeof bx === 'string' ? bx : (bx.id || bIdx);
                          const bName = typeof bx === 'string' ? bx : bx.name;
                          return (
                            <option key={bId} value={bId}>
                              {bName}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                </div>

                {/* Live Picking Location Badge */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px' }}>📍</span>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', display: 'block', letterSpacing: '0.03em' }}>
                        Live Storage &amp; Picking Coordinate:
                      </span>
                      <strong style={{ fontSize: '12px', color: '#1e3a8a', wordBreak: 'break-word' }}>
                        {formattedPickingPath}
                      </strong>
                    </div>
                  </div>
                  {formattedLocationCode && (
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '4px' }}>
                      {formattedLocationCode}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Reason (Required for Adjustment) */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                Reason {movementType === 'ADJUSTMENT' && <span style={{ color: '#ef4444' }}>* (Required)</span>}
              </label>
              <input
                type="text"
                required={movementType === 'ADJUSTMENT'}
                placeholder={movementType === 'ADJUSTMENT' ? "e.g. Physical count audit reconciliation discrepancy" : "Reason or purpose of movement"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                Audit Notes / Remarks
              </label>
              <textarea
                rows="2"
                placeholder="Optional notes or remarks for audit trail..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="movement-preview-metric" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <small style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Stock</small>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{currentStock}</strong>
              </div>
              <div>
                <small style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Movement</small>
                <strong style={{ fontSize: '16px', color: effectiveDelta > 0 ? '#16a34a' : (effectiveDelta < 0 ? '#dc2626' : '#64748b') }}>
                  {effectiveDelta > 0 ? `+${effectiveDelta}` : (effectiveDelta < 0 ? `${effectiveDelta}` : '0')}
                </strong>
              </div>
              <div>
                <small style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Stock After</small>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{projectedTotalStock}</strong>
              </div>
              <div>
                <small style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Available After</small>
                <strong style={{ fontSize: '16px', color: projectedAvailableStock > 0 ? '#2563eb' : '#dc2626' }}>
                  {projectedAvailableStock}
                </strong>
              </div>
            </div>
          </div>

          <div className="crm-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary"
              disabled={submitting}
              style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {submitting ? 'Recording Movement...' : 'Save Stock Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
