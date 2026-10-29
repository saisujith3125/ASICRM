import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  Layers,
  Grid,
  Box,
  Package,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Tag,
  Barcode,
  Printer,
  ExternalLink,
  Check,
  Copy,
  AlertTriangle,
  TrendingUp,
  Plus,
  Move,
  X,
  ChevronRight,
  ShieldCheck,
  Eye,
  Info,
  DollarSign
} from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import './warehouse.css';

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

function formatCurrency(val) {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WarehouseView({ user }) {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [activeFloorId, setActiveFloorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState(null);

  // Search Locator
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedBoxId, setHighlightedBoxId] = useState('');

  // Selected Box for Drawer Inspection
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQrPrintModal, setShowQrPrintModal] = useState(false);

  // Catalog products for assignment modal
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [assignProductId, setAssignProductId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Transfer state
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferDestBoxId, setTransferDestBoxId] = useState('');
  const [transferReason, setTransferReason] = useState('Bay Reorganization');
  const [transferLoading, setTransferLoading] = useState(false);

  // Copy notification state
  const [copiedCode, setCopiedCode] = useState('');

  const searchInputRef = useRef(null);

  // Fetch warehouses and product catalog
  const loadWarehouseData = async () => {
    setLoading(true);
    setError('');
    try {
      const [whRes, prodRes] = await Promise.all([
        apiFetch(apiUrl('/api/warehouses'), { headers: authHeaders(user) }),
        apiFetch(apiUrl('/api/stocks/products'), { headers: authHeaders(user) })
      ]);

      const [whJson, prodJson] = await Promise.all([whRes.json(), prodRes.json()]);

      if (whRes.ok && whJson.success) {
        setWarehouses(whJson.data || []);
        setKpis(whJson.kpis || null);

        // Select default warehouse if not selected
        if (!selectedWarehouseId && whJson.data?.length > 0) {
          const defWh = whJson.data.find((w) => w.isDefault) || whJson.data[0];
          setSelectedWarehouseId(defWh.id);
          const firstFloor = defWh.layout?.floors?.[0];
          if (firstFloor) setActiveFloorId(firstFloor.id);
        }
      } else {
        setError(whJson?.message || 'Failed to load warehouses.');
      }

      if (prodRes.ok) {
        const pList = Array.isArray(prodJson.data) ? prodJson.data : (Array.isArray(prodJson) ? prodJson : []);
        setCatalogProducts(pList);
      }
    } catch (err) {
      setError(err.message || 'Error connecting to warehouse service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouseData();
  }, []);

  // Current active warehouse object
  const activeWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0] || null;
  }, [warehouses, selectedWarehouseId]);

  // Current active floor object
  const activeFloor = useMemo(() => {
    if (!activeWarehouse || !activeWarehouse.layout?.floors) return null;
    return activeWarehouse.layout.floors.find((f) => f.id === activeFloorId) || activeWarehouse.layout.floors[0] || null;
  }, [activeWarehouse, activeFloorId]);

  // When warehouse changes, ensure active floor is valid
  useEffect(() => {
    if (activeWarehouse?.layout?.floors?.length > 0) {
      const currentValid = activeWarehouse.layout.floors.some((f) => f.id === activeFloorId);
      if (!currentValid) {
        setActiveFloorId(activeWarehouse.layout.floors[0].id);
      }
    }
  }, [activeWarehouse]);

  // Handle Search Locator (Scan / Type product SKU or serial)
  const handleLocatorSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchLoading(true);
    setSearchResult(null);
    setHighlightedBoxId('');

    try {
      const res = await apiFetch(apiUrl(`/api/warehouses/search?q=${encodeURIComponent(query)}`), {
        headers: authHeaders(user)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setSearchResult(json);
        const loc = json.location;

        // Switch to warehouse if different
        if (loc.warehouseId && loc.warehouseId !== selectedWarehouseId) {
          setSelectedWarehouseId(loc.warehouseId);
        }

        // Switch to floor if different
        if (loc.floorId) {
          setActiveFloorId(loc.floorId);
        }

        // Highlight box
        const targetBoxId = loc.boxId || loc.box;
        setHighlightedBoxId(targetBoxId);

        // Scroll to highlighted box element
        setTimeout(() => {
          const el = document.getElementById(`box-cubby-${targetBoxId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      } else {
        setSearchResult({ error: json?.message || `No location found for "${query}"` });
      }
    } catch (err) {
      setSearchResult({ error: err.message || 'Search failed.' });
    } finally {
      setSearchLoading(false);
    }
  };

  // Open inspection drawer for a box
  const handleInspectBox = (bx, sh, rk, fl) => {
    setSelectedBox(bx);
    setSelectedShelf(sh);
    setSelectedRack(rk);
    setSelectedFloor(fl);
  };

  // Copy helper
  const handleCopy = (text, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Assign Product to Box submit
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignProductId || !selectedBox) return;

    setAssignLoading(true);
    try {
      const payload = {
        productId: assignProductId,
        warehouseId: activeWarehouse?.id,
        warehouseName: activeWarehouse?.name,
        floor: selectedFloor?.name || activeFloor?.name,
        rack: selectedRack?.name,
        shelf: selectedShelf?.name,
        box: selectedBox.name,
        locationCode: `${activeWarehouse?.code}-${selectedRack?.code}-${selectedShelf?.code}-${selectedBox.code}`
      };

      const res = await apiFetch(apiUrl('/api/warehouses/assign-bin'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setShowAssignModal(false);
        setAssignProductId('');
        await loadWarehouseData();
        // Update selectedBox locally if open
        setSelectedBox((prev) => prev ? {
          ...prev,
          isOccupied: true,
          assignedProductsCount: (prev.assignedProductsCount || 0) + 1,
          assignedProducts: [...(prev.assignedProducts || []), json.product]
        } : null);
      } else {
        alert(json?.message || 'Failed to assign product.');
      }
    } catch (err) {
      alert(err.message || 'Error assigning product to bin.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Transfer stock submit
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferProductId || !transferDestBoxId || !selectedBox) return;

    setTransferLoading(true);
    try {
      const allBoxes = [];
      activeWarehouse?.layout?.floors?.forEach((fl) => {
        fl.racks?.forEach((rk) => {
          rk.shelves?.forEach((sh) => {
            sh.boxes?.forEach((b) => {
              allBoxes.push({ ...b, floorName: fl.name, rackName: rk.name, shelfName: sh.name });
            });
          });
        });
      });

      const destBoxObj = allBoxes.find((b) => b.id === transferDestBoxId || b.name === transferDestBoxId);

      const payload = {
        productId: transferProductId,
        quantity: Number(transferQty || 1),
        sourceLocation: {
          warehouseId: activeWarehouse?.id,
          warehouseName: activeWarehouse?.name,
          box: selectedBox.name,
          binLocation: `${activeWarehouse?.name} › ${selectedFloor?.name} › ${selectedRack?.name} › ${selectedShelf?.name} › ${selectedBox.name}`
        },
        destLocation: {
          warehouseId: activeWarehouse?.id,
          warehouseName: activeWarehouse?.name,
          floor: destBoxObj?.floorName,
          rack: destBoxObj?.rackName,
          shelf: destBoxObj?.shelfName,
          box: destBoxObj?.name,
          binLocation: `${activeWarehouse?.name} › ${destBoxObj?.floorName} › ${destBoxObj?.rackName} › ${destBoxObj?.shelfName} › ${destBoxObj?.name}`
        },
        reason: transferReason,
        notes: `Bin relocation from ${selectedBox.name} to ${destBoxObj?.name}`
      };

      const res = await apiFetch(apiUrl('/api/warehouses/transfer-bin'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setShowTransferModal(false);
        setTransferProductId('');
        await loadWarehouseData();
      } else {
        alert(json?.message || 'Failed to transfer stock.');
      }
    } catch (err) {
      alert(err.message || 'Error processing transfer.');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="wh-page-wrapper custom-wh-scrollbar">
      {/* 1. TOP HEADER & WAREHOUSE SELECTOR */}
      <div className="wh-header-bar">
        <div className="wh-header-info">
          <div className="wh-header-badge">
            <Building2 size={16} />
            <span>WAREHOUSE FACILITY &amp; BAY COORDINATE SYSTEM</span>
          </div>
          <h1 className="wh-page-title">Warehouse Storage &amp; Bin Hierarchy</h1>
          <p className="wh-page-subtitle">
            Medical-store &amp; high-density picking layout: trace every hardware unit to its exact
            <strong> Floor › Rack › Shelf › Box (Bin)</strong> coordinate for rapid employee retrieval and dispatch.
          </p>
        </div>

        <div className="wh-header-controls">
          {/* Warehouse Facility Dropdown */}
          <div className="wh-facility-select-wrap">
            <label className="wh-select-label">Active Facility:</label>
            <select
              className="wh-facility-select"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code}) {wh.isDefault ? '— Default Central' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={loadWarehouseData}
            title="Refresh warehouse stock and bin allocations"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. TOP FACILITY METRICS STRIP */}
      {activeWarehouse && (
        <div className="wh-kpi-grid">
          {/* Total Bins */}
          <div className="wh-kpi-card total">
            <div className="wh-kpi-icon total">
              <Grid size={20} />
            </div>
            <div className="wh-kpi-details">
              <span className="wh-kpi-label">Total Storage Bins</span>
              <span className="wh-kpi-value">{activeWarehouse.totalBoxesCount || 0}</span>
              <span className="wh-kpi-subtext">Across {activeWarehouse.racksCount || 0} Racks</span>
            </div>
          </div>

          {/* Occupied Bins */}
          <div className="wh-kpi-card occupied">
            <div className="wh-kpi-icon occupied">
              <Box size={20} />
            </div>
            <div className="wh-kpi-details">
              <span className="wh-kpi-label">Occupied Bins</span>
              <span className="wh-kpi-value">{activeWarehouse.occupiedBoxesCount || 0}</span>
              <span className="wh-kpi-subtext">{activeWarehouse.occupancyRate || 0}% Capacity Used</span>
            </div>
          </div>

          {/* Empty Bins Available */}
          <div className="wh-kpi-card empty">
            <div className="wh-kpi-icon empty">
              <Plus size={20} />
            </div>
            <div className="wh-kpi-details">
              <span className="wh-kpi-label">Available Empty Bins</span>
              <span className="wh-kpi-value">{activeWarehouse.emptyBoxesCount || 0}</span>
              <span className="wh-kpi-subtext">Ready for Stock Allocation</span>
            </div>
          </div>

          {/* On-Hand Stock in Facility */}
          <div className="wh-kpi-card stock">
            <div className="wh-kpi-icon stock">
              <Package size={20} />
            </div>
            <div className="wh-kpi-details">
              <span className="wh-kpi-label">Physical Stock Units</span>
              <span className="wh-kpi-value">{(activeWarehouse.totalStockUnits || 0).toLocaleString()}</span>
              <span className="wh-kpi-subtext">Units Inside Bins</span>
            </div>
          </div>

          {/* Inventory Valuation */}
          <div className="wh-kpi-card valuation">
            <div className="wh-kpi-icon valuation">
              <DollarSign size={20} />
            </div>
            <div className="wh-kpi-details">
              <span className="wh-kpi-label">Facility Valuation</span>
              <span className="wh-kpi-value">{formatCurrency(activeWarehouse.totalValuation)}</span>
              <span className="wh-kpi-subtext">{activeWarehouse.capacity || 'Storage Area'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. QUICK BIN LOCATOR SEARCH BAR */}
      <div className="wh-locator-bar">
        <form className="wh-locator-form" onSubmit={handleLocatorSearch}>
          <div className="wh-locator-input-wrap">
            <Search size={18} className="wh-locator-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="wh-locator-input"
              placeholder="Find Item / Quick Bin Locator: Scan or type Product Name, SKU, Camera Model, or Serial Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="wh-locator-clear"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResult(null);
                  setHighlightedBoxId('');
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button type="submit" className="wh-locator-btn" disabled={searchLoading}>
            <Search size={15} />
            {searchLoading ? 'Locating...' : 'Locate Bin'}
          </button>
        </form>

        {/* Search Result Banner */}
        {searchResult && (
          <div className={`wh-locator-result-banner ${searchResult.error ? 'error' : 'success'}`}>
            {searchResult.error ? (
              <>
                <AlertTriangle size={18} />
                <span>{searchResult.error}</span>
              </>
            ) : (
              <>
                <Check size={18} style={{ color: '#16a34a' }} />
                <div className="wh-result-content">
                  <strong>{searchResult.product?.name} ({searchResult.product?.code})</strong>
                  <span className="wh-result-coord-tag">
                    📍 Located at: <strong>{searchResult.fullCoordinateString}</strong>
                  </span>
                  <span className="wh-result-stock-tag">
                    Stock: {searchResult.product?.stock} Units {searchResult.product?.serialized ? `(${searchResult.product?.serialNumbers?.length || 0} Serials)` : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. FLOOR SELECTOR TABS */}
      {activeWarehouse?.layout?.floors && (
        <div className="wh-floor-tabs-bar">
          <div className="wh-floor-tabs-label">
            <Layers size={16} />
            <span>Select Facility Floor:</span>
          </div>
          <div className="wh-floor-tabs-list">
            {activeWarehouse.layout.floors.map((fl, flIdx) => (
              <button
                key={fl.id || flIdx}
                type="button"
                className={`wh-floor-tab-btn ${activeFloorId === fl.id ? 'active' : ''}`}
                onClick={() => setActiveFloorId(fl.id)}
              >
                <span className="floor-dot" />
                {fl.name} ({fl.code})
                <span className="floor-rack-badge">{fl.racks?.length || 0} Racks</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. VISUAL RACKS & PHYSICAL SHELF GRID (WITH CUSTOM DESIGNED SCROLL) */}
      <div className="wh-bays-scroll-viewport custom-wh-scrollbar">
        {loading ? (
          <div className="wh-loading-card">
            <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 10px auto' }} />
            <span>Loading warehouse floor plan &amp; physical rack bays...</span>
          </div>
        ) : error ? (
          <div className="wh-error-card">
            <AlertTriangle size={32} style={{ color: '#dc2626', marginBottom: '8px' }} />
            <strong>{error}</strong>
          </div>
        ) : !activeFloor || !activeFloor.racks || activeFloor.racks.length === 0 ? (
          <div className="wh-empty-floor-card">
            <Building2 size={36} style={{ color: '#94a3b8', margin: '0 auto 10px auto' }} />
            <h4>No racks configured on this floor</h4>
            <p>Go to Settings &gt; Warehouses to configure racks, shelves, and boxes.</p>
          </div>
        ) : (
          <div className="wh-racks-grid">
            {activeFloor.racks.map((rk, rkIdx) => (
              <div key={rk.id || rkIdx} className="wh-rack-container-card">
                {/* Rack Header */}
                <div className="wh-rack-card-header">
                  <div className="wh-rack-title-row">
                    <span className="wh-rack-code-pill mono">{rk.code || `RK-${rkIdx + 1}`}</span>
                    <h3 className="wh-rack-name">{rk.name}</h3>
                  </div>

                  <div className="wh-rack-meta-row">
                    <span className="wh-rack-occupancy-pill">
                      Occupancy: {rk.occupancyRate || 0}% ({rk.occupiedBoxes || 0}/{rk.totalBoxes || 0} Bins)
                    </span>
                    <span className="wh-rack-val-pill mono">
                      {formatCurrency(rk.valuation)} ({rk.stockQuantity || 0} units)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="wh-rack-progress-track">
                    <div
                      className="wh-rack-progress-fill"
                      style={{ width: `${Math.min(100, rk.occupancyRate || 0)}%` }}
                    />
                  </div>
                </div>

                {/* Vertical Shelf Tiers */}
                <div className="wh-rack-shelves-stack">
                  {(rk.shelves || []).map((sh, shIdx) => (
                    <div key={sh.id || shIdx} className="wh-shelf-level-wrapper">
                      {/* Shelf Strut Header */}
                      <div className="wh-shelf-strut-bar">
                        <div className="wh-shelf-label-row">
                          <span className="wh-shelf-strut-tag mono">{sh.code || `SH-${shIdx + 1}`}</span>
                          <span className="wh-shelf-name">{sh.name}</span>
                        </div>
                        <span className="wh-shelf-box-count">{(sh.boxes || []).length} Bins</span>
                      </div>

                      {/* Boxes / Bins Cubbies in Shelf */}
                      <div className="wh-boxes-cubby-grid">
                        {(sh.boxes || []).map((bx, bxIdx) => {
                          const isOccupied = bx.isOccupied || (bx.assignedProductsCount > 0);
                          const isHighlighted = highlightedBoxId === bx.id || highlightedBoxId === bx.name;
                          const hasLowStock = bx.assignedProducts?.some((p) => p.isLowStock);

                          return (
                            <div
                              id={`box-cubby-${bx.id}`}
                              key={bx.id || bxIdx}
                              className={`wh-box-cubby ${
                                isOccupied ? 'occupied' : 'empty'
                              } ${isHighlighted ? 'highlight-pulse' : ''} ${hasLowStock ? 'low-stock' : ''}`}
                              onClick={() => handleInspectBox(bx, sh, rk, activeFloor)}
                              title={`Click to inspect Box: ${bx.name}`}
                            >
                              {/* Box Top Label */}
                              <div className="wh-box-top-line">
                                <span className="wh-box-code-badge mono">{bx.code || `BX-${bxIdx + 1}`}</span>
                                <span className={`wh-box-status-indicator ${isOccupied ? 'occupied' : 'empty'}`}>
                                  {isOccupied ? '● Occupied' : '○ Empty'}
                                </span>
                              </div>

                              <div className="wh-box-name" title={bx.name}>
                                {bx.name}
                              </div>

                              {isOccupied ? (
                                <div className="wh-box-product-info">
                                  <div className="wh-box-prod-list">
                                    {bx.assignedProducts?.slice(0, 2).map((p, pIdx) => (
                                      <div key={p.id || pIdx} className="wh-box-prod-item">
                                        <span className="wh-box-prod-name" title={p.name}>
                                          {p.name}
                                        </span>
                                        <span className="wh-box-prod-qty mono">
                                          {p.stock} units
                                        </span>
                                      </div>
                                    ))}
                                    {bx.assignedProductsCount > 2 && (
                                      <span className="wh-box-more-tag">
                                        +{bx.assignedProductsCount - 2} more items
                                      </span>
                                    )}
                                  </div>

                                  <div className="wh-box-foot-stats">
                                    <span className="wh-box-qty-badge mono">
                                      {bx.stockQuantity} Units
                                    </span>
                                    {bx.serialsCount > 0 && (
                                      <span className="wh-box-serials-badge mono" title={`${bx.serialsCount} Serial Numbers Allocated`}>
                                        <Tag size={10} /> {bx.serialsCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="wh-box-empty-prompt">
                                  <span>Empty Bin</span>
                                  <span className="wh-box-assign-hint">+ Click to Assign</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. INTERACTIVE BOX / BIN INSPECTION DRAWER */}
      {selectedBox && (
        <div className="wh-drawer-overlay" onClick={() => setSelectedBox(null)}>
          <div className="wh-drawer-card custom-wh-scrollbar" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="wh-drawer-header">
              <div className="wh-drawer-title-wrap">
                <div className="wh-drawer-badge">
                  <Box size={16} />
                  <span>STORAGE BIN COORD: {selectedBox.code}</span>
                </div>
                <h2 className="wh-drawer-title">{selectedBox.name}</h2>
                <span className="wh-drawer-coord-path">
                  📍 {activeWarehouse?.name} › {selectedFloor?.name} › {selectedRack?.name} › {selectedShelf?.name} › {selectedBox.name}
                </span>
              </div>

              <button
                type="button"
                className="wh-drawer-close-btn"
                onClick={() => setSelectedBox(null)}
                title="Close Drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="wh-drawer-body custom-wh-scrollbar">
              {/* Coordinate Code Strip */}
              <div className="wh-drawer-code-strip">
                <div>
                  <span className="wh-code-label">Full Location Identifier</span>
                  <div className="wh-code-val mono">
                    {activeWarehouse?.code}-{selectedRack?.code}-{selectedShelf?.code}-{selectedBox.code}
                  </div>
                </div>
                <button
                  type="button"
                  className="wh-copy-code-btn"
                  onClick={(e) =>
                    handleCopy(
                      `${activeWarehouse?.code}-${selectedRack?.code}-${selectedShelf?.code}-${selectedBox.code}`,
                      e
                    )
                  }
                  title="Copy location coordinate string"
                >
                  {copiedCode ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="wh-drawer-actions-row">
                <button
                  type="button"
                  className="wh-btn wh-btn-primary"
                  onClick={() => setShowAssignModal(true)}
                >
                  <Plus size={14} /> Assign New Product
                </button>
                {selectedBox.isOccupied && (
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary"
                    onClick={() => {
                      setTransferProductId(selectedBox.assignedProducts?.[0]?.id || '');
                      setShowTransferModal(true);
                    }}
                  >
                    <Move size={14} /> Relocate Stock
                  </button>
                )}
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setShowQrPrintModal(true)}
                  title="Print Bin Barcode/QR Adhesive Sticker"
                >
                  <Printer size={14} /> Print Bin Label
                </button>
              </div>

              {/* Contained Products Section */}
              <div className="wh-drawer-section">
                <h4 className="wh-section-title">
                  <Package size={15} /> Contained Inventory Products ({selectedBox.assignedProductsCount || 0})
                </h4>

                {!selectedBox.isOccupied || selectedBox.assignedProductsCount === 0 ? (
                  <div className="wh-drawer-empty-box-notice">
                    <Box size={32} style={{ color: '#94a3b8', margin: '0 auto 8px auto', display: 'block' }} />
                    <strong>This Bin is Currently Empty</strong>
                    <p>No products or serial units are assigned here yet. Use "Assign New Product" to stock this bin.</p>
                  </div>
                ) : (
                  <div className="wh-drawer-products-list">
                    {selectedBox.assignedProducts?.map((prod, pIdx) => (
                      <div key={prod.id || pIdx} className="wh-drawer-product-card">
                        <div className="wh-prod-card-top">
                          <div>
                            <strong className="wh-prod-card-name">{prod.name}</strong>
                            <span className="wh-prod-card-code mono">SKU: {prod.code}</span>
                          </div>
                          <div className="wh-prod-card-stock">
                            <span className="wh-prod-qty mono">{prod.stock} Units</span>
                            <span className="wh-prod-val mono">{formatCurrency(prod.stock * prod.cost)}</span>
                          </div>
                        </div>

                        {/* Serials List */}
                        {prod.serialized && Array.isArray(prod.serialNumbers) && prod.serialNumbers.length > 0 && (
                          <div className="wh-drawer-serials-box">
                            <div className="wh-serials-box-title">
                              <Tag size={12} /> Stored Serial Numbers ({prod.serialNumbers.length}):
                            </div>
                            <div className="wh-drawer-serial-tags-grid custom-wh-scrollbar">
                              {prod.serialNumbers.map((sn, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="wh-drawer-sn-tag mono"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBox(null);
                                    navigate(`/serials?q=${encodeURIComponent(sn)}`);
                                  }}
                                  title="Click to track complete serial provenance & profit"
                                >
                                  {sn}
                                  <ExternalLink size={10} style={{ marginLeft: '4px' }} />
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ASSIGN PRODUCT TO BIN MODAL */}
      {showAssignModal && selectedBox && (
        <div className="wh-modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="wh-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Assign Product to Bin: {selectedBox.name}</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="wh-modal-body">
                <p className="wh-modal-desc">
                  Select a product from the catalog to assign its primary warehouse picking coordinate to
                  <strong> {selectedBox.name}</strong> ({selectedRack?.name} › {selectedShelf?.name}).
                </p>

                <div className="wh-form-field">
                  <label className="wh-form-label">Select Hardware Product:</label>
                  <select
                    className="wh-form-select"
                    value={assignProductId}
                    onChange={(e) => setAssignProductId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Product to Assign --</option>
                    {catalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} (On Hand: {p.stock || 0} units)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={assignLoading || !assignProductId}
                >
                  {assignLoading ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. RELOCATE / TRANSFER STOCK MODAL */}
      {showTransferModal && selectedBox && (
        <div className="wh-modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="wh-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Internal Bin Relocation</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => setShowTransferModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              <div className="wh-modal-body">
                <div className="wh-transfer-source-strip">
                  <span className="wh-strip-label">Origin Location:</span>
                  <strong>{selectedBox.name} ({selectedRack?.name} › {selectedShelf?.name})</strong>
                </div>

                <div className="wh-form-field">
                  <label className="wh-form-label">Product to Move:</label>
                  <select
                    className="wh-form-select"
                    value={transferProductId}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    required
                  >
                    {selectedBox.assignedProducts?.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} (Available: {p.stock} units)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wh-form-field">
                  <label className="wh-form-label">Quantity to Transfer:</label>
                  <input
                    type="number"
                    min="1"
                    className="wh-form-input"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    required
                  />
                </div>

                <div className="wh-form-field">
                  <label className="wh-form-label">Destination Bin Coordinate:</label>
                  <select
                    className="wh-form-select"
                    value={transferDestBoxId}
                    onChange={(e) => setTransferDestBoxId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Target Box / Bin --</option>
                    {activeWarehouse?.layout?.floors?.map((fl) =>
                      fl.racks?.map((rk) =>
                        rk.shelves?.map((sh) =>
                          sh.boxes?.map((b) => (
                            <option key={b.id} value={b.id}>
                              {fl.name} › {rk.name} › {sh.name} › {b.name}
                            </option>
                          ))
                        )
                      )
                    )}
                  </select>
                </div>

                <div className="wh-form-field">
                  <label className="wh-form-label">Transfer Justification / Reason:</label>
                  <input
                    type="text"
                    className="wh-form-input"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="e.g. Rack A capacity optimization, Fast-picking shelf move"
                  />
                </div>
              </div>
              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={transferLoading || !transferProductId || !transferDestBoxId}
                >
                  {transferLoading ? 'Relocating...' : 'Execute Relocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. PRINT BIN QR / BARCODE LABEL MODAL */}
      {showQrPrintModal && selectedBox && (
        <div className="wh-modal-overlay" onClick={() => setShowQrPrintModal(false)}>
          <div className="wh-modal-dialog print-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Print Bin Barcode &amp; Coordinate Label</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => setShowQrPrintModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="wh-modal-body">
              <p className="wh-modal-desc">
                Standard 2-inch adhesive warehouse shelf sticker for handheld barcode scanner integration:
              </p>

              {/* Printable Adhesive Label Preview */}
              <div className="wh-printable-sticker-card" id="printable-bin-sticker">
                <div className="sticker-header">
                  <strong>ACTIVE SYSTEM INTEGRATION</strong>
                  <span className="sticker-facility">{activeWarehouse?.name}</span>
                </div>
                <div className="sticker-barcode-zone">
                  <Barcode size={48} />
                  <span className="sticker-code mono">
                    {activeWarehouse?.code}-{selectedRack?.code}-{selectedShelf?.code}-{selectedBox.code}
                  </span>
                </div>
                <div className="sticker-details">
                  <div className="sticker-bin-name">{selectedBox.name}</div>
                  <div className="sticker-path">
                    {selectedFloor?.name} › {selectedRack?.name} › {selectedShelf?.name}
                  </div>
                </div>
              </div>
            </div>
            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setShowQrPrintModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print Sticker (2" x 1.5")
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
