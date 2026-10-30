import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Box,
  Layers,
  Package,
  TrendingUp,
  ShieldCheck,
  Tag,
  Barcode,
  Printer,
  Copy,
  Check,
  Plus,
  Move,
  Search,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Building2,
  AlertTriangle,
  X
} from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';

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

export default function WarehouseBoxDetailPage({
  boxContext,
  allWarehouses = [],
  catalogProducts = [],
  user,
  onBack,
  onRefresh
}) {
  const { warehouse, floor, rack, shelf, box } = boxContext || {};

  const [copiedCode, setCopiedCode] = useState('');
  const [copiedSerial, setCopiedSerial] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [selectedProductForSerials, setSelectedProductForSerials] = useState(null);

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQrPrintModal, setShowQrPrintModal] = useState(false);

  // Assign modal state
  const [assignProductId, setAssignProductId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Transfer modal state
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferDestBoxId, setTransferDestBoxId] = useState('');
  const [transferReason, setTransferReason] = useState('Bay Reorganization');
  const [transferLoading, setTransferLoading] = useState(false);

  if (!boxContext || !box) {
    return (
      <div className="wh-page-wrapper">
        <div className="wh-error-card" style={{ margin: '40px auto', maxWidth: '500px' }}>
          <AlertTriangle size={36} style={{ color: '#dc2626', marginBottom: '12px' }} />
          <h3>Storage Bin Not Found</h3>
          <p style={{ marginTop: '8px', color: '#64748b' }}>
            The requested warehouse box coordinate could not be located in the facility hierarchy.
          </p>
          <button
            type="button"
            className="wh-btn wh-btn-primary"
            onClick={onBack}
            style={{ marginTop: '16px' }}
          >
            <ArrowLeft size={14} /> Back to Warehouse Floor Plan
          </button>
        </div>
      </div>
    );
  }

  const assignedProducts = Array.isArray(box.assignedProducts) ? box.assignedProducts : [];
  const isOccupied = box.isOccupied || assignedProducts.length > 0;

  // Total valuation and quantities
  const totalQuantity = useMemo(() => {
    return assignedProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  }, [assignedProducts]);

  const totalValuation = useMemo(() => {
    return assignedProducts.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.cost || 0)), 0);
  }, [assignedProducts]);

  const totalSerialsCount = useMemo(() => {
    return assignedProducts.reduce((sum, p) => sum + (Array.isArray(p.serialNumbers) ? p.serialNumbers.length : 0), 0);
  }, [assignedProducts]);

  const locationCode = `${warehouse?.code || 'WH'}-${rack?.code || 'RK'}-${shelf?.code || 'SH'}-${box?.code || 'BX'}`;

  // Copy helper
  const handleCopy = (text, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleCopySingleSerial = (sn, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(sn);
    setCopiedSerial(sn);
    setTimeout(() => setCopiedSerial(''), 1800);
  };

  const handleCopyAllSerials = (serials, e) => {
    if (e) e.stopPropagation();
    const joined = (serials || []).join(', ');
    navigator.clipboard?.writeText(joined);
    setCopiedSerial('ALL');
    setTimeout(() => setCopiedSerial(''), 1800);
  };

  // Assign product submit
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignProductId || !box) return;

    setAssignLoading(true);
    try {
      const payload = {
        productId: assignProductId,
        warehouseId: warehouse?.id,
        warehouseName: warehouse?.name,
        floor: floor?.name,
        rack: rack?.name,
        shelf: shelf?.name,
        box: box.name,
        locationCode
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
        if (onRefresh) onRefresh();
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
    if (!transferProductId || !transferDestBoxId || !box) return;

    setTransferLoading(true);
    try {
      const allBoxes = [];
      allWarehouses.forEach((wh) => {
        wh.layout?.floors?.forEach((fl) => {
          fl.racks?.forEach((rk) => {
            rk.shelves?.forEach((sh) => {
              sh.boxes?.forEach((b) => {
                allBoxes.push({
                  ...b,
                  warehouseId: wh.id,
                  warehouseName: wh.name,
                  floorName: fl.name,
                  rackName: rk.name,
                  shelfName: sh.name
                });
              });
            });
          });
        });
      });

      const destBoxObj = allBoxes.find((b) => b.id === transferDestBoxId || b.name === transferDestBoxId);

      const payload = {
        productId: transferProductId,
        quantity: Number(transferQty || 1),
        sourceLocation: {
          warehouseId: warehouse?.id,
          warehouseName: warehouse?.name,
          box: box.name,
          binLocation: `${warehouse?.name} › ${floor?.name} › ${rack?.name} › ${shelf?.name} › ${box.name}`
        },
        destLocation: {
          warehouseId: destBoxObj?.warehouseId || warehouse?.id,
          warehouseName: destBoxObj?.warehouseName || warehouse?.name,
          floor: destBoxObj?.floorName,
          rack: destBoxObj?.rackName,
          shelf: destBoxObj?.shelfName,
          box: destBoxObj?.name,
          binLocation: `${destBoxObj?.warehouseName || warehouse?.name} › ${destBoxObj?.floorName} › ${destBoxObj?.rackName} › ${destBoxObj?.shelfName} › ${destBoxObj?.name}`
        },
        reason: transferReason,
        notes: `Bin relocation from ${box.name} to ${destBoxObj?.name}`
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
        if (onRefresh) onRefresh();
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
    <div className="wh-detail-page-container custom-wh-scrollbar">
      {/* 1. TOP BREADCRUMB & BACK NAVIGATION BAR */}
      <div className="wh-detail-top-nav">
        <button
          type="button"
          className="wh-detail-back-btn"
          onClick={onBack}
          title="Return to visual rack & floor layout"
        >
          <ArrowLeft size={15} />
          <span>Back to Warehouse Floor Plan</span>
        </button>

        <div className="wh-detail-breadcrumbs">
          <span className="wh-bc-item link" onClick={onBack}>Warehouses</span>
          <ChevronRight size={13} className="wh-bc-sep" />
          <span className="wh-bc-item link" onClick={onBack}>{warehouse?.name}</span>
          <ChevronRight size={13} className="wh-bc-sep" />
          <span className="wh-bc-item">{floor?.name}</span>
          <ChevronRight size={13} className="wh-bc-sep" />
          <span className="wh-bc-item">{rack?.name}</span>
          <ChevronRight size={13} className="wh-bc-sep" />
          <span className="wh-bc-item">{shelf?.name}</span>
          <ChevronRight size={13} className="wh-bc-sep" />
          <strong className="wh-bc-item current">{box.name}</strong>
        </div>
      </div>

      {/* 2. MAIN HEADER CARD WITH ACTION BUTTONS */}
      <div className="wh-detail-header-card">
        <div className="wh-detail-header-left">
          <div className="wh-detail-icon-wrap">
            <Box size={24} style={{ color: '#2563eb' }} />
          </div>
          <div>
            <div className="wh-detail-title-line">
              <span className="wh-detail-coord-pill mono">
                STORAGE BIN COORD: {box.code}
              </span>
              <h1 className="wh-detail-title">{box.name}</h1>
              <span className={`wh-detail-status-pill ${isOccupied ? 'occupied' : 'empty'}`}>
                {isOccupied ? `● Occupied (${totalQuantity} Units)` : '○ Empty Bin'}
              </span>
            </div>
            <div className="wh-detail-path-text">
              📍 {warehouse?.name} › {floor?.name} › {rack?.name} › {shelf?.name} › {box.name}
            </div>
          </div>
        </div>

        <div className="wh-detail-header-actions">
          <button
            type="button"
            className="wh-btn wh-btn-primary"
            onClick={() => setShowAssignModal(true)}
          >
            <Plus size={14} />
            <span>Assign New Product</span>
          </button>

          {isOccupied && (
            <button
              type="button"
              className="wh-btn wh-btn-secondary"
              onClick={() => {
                setTransferProductId(assignedProducts[0]?.id || '');
                setShowTransferModal(true);
              }}
            >
              <Move size={14} />
              <span>Relocate Stock</span>
            </button>
          )}

          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={() => setShowQrPrintModal(true)}
            title="Print 2-inch adhesive barcode sticker for this bin"
          >
            <Printer size={14} />
            <span>Print Bin Label</span>
          </button>
        </div>
      </div>

      {/* 3. FULL LOCATION IDENTIFIER STRIP */}
      <div className="wh-detail-ident-strip">
        <div className="wh-ident-left">
          <span className="wh-ident-label">Full Location Identifier:</span>
          <code className="wh-ident-code mono">{locationCode}</code>
          <button
            type="button"
            className="wh-copy-code-btn compact"
            onClick={(e) => handleCopy(locationCode, e)}
            title="Copy coordinate string to clipboard"
          >
            {copiedCode ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="wh-ident-right">
          <span className="wh-ident-tag">Facility: <strong>{warehouse?.name}</strong></span>
          <span className="wh-ident-tag">Rack: <strong>{rack?.name}</strong></span>
          <span className="wh-ident-tag">Shelf: <strong>{shelf?.name}</strong></span>
        </div>
      </div>

      {/* 4. 4 KPI SUMMARY METRICS ROW */}
      <div className="wh-detail-kpi-grid">
        <div className="wh-detail-kpi-card">
          <div className="wh-detail-kpi-icon blue">
            <Package size={20} />
          </div>
          <div className="wh-detail-kpi-data">
            <span className="wh-kpi-lbl">Contained Products</span>
            <span className="wh-kpi-val">{assignedProducts.length} Product Types</span>
            <span className="wh-kpi-sub">Distinct SKUs in bin</span>
          </div>
        </div>

        <div className="wh-detail-kpi-card">
          <div className="wh-detail-kpi-icon emerald">
            <Layers size={20} />
          </div>
          <div className="wh-detail-kpi-data">
            <span className="wh-kpi-lbl">Total Physical Units</span>
            <span className="wh-kpi-val">{totalQuantity} Units</span>
            <span className="wh-kpi-sub">Aggregated inventory count</span>
          </div>
        </div>

        <div className="wh-detail-kpi-card">
          <div className="wh-detail-kpi-icon violet">
            <TrendingUp size={20} />
          </div>
          <div className="wh-detail-kpi-data">
            <span className="wh-kpi-lbl">Total Stock Valuation</span>
            <span className="wh-kpi-val mono">{formatCurrency(totalValuation)}</span>
            <span className="wh-kpi-sub">Based on landed unit costs</span>
          </div>
        </div>

        <div className="wh-detail-kpi-card">
          <div className="wh-detail-kpi-icon amber">
            <ShieldCheck size={20} />
          </div>
          <div className="wh-detail-kpi-data">
            <span className="wh-kpi-lbl">Serials &amp; Status</span>
            <span className="wh-kpi-val">{isOccupied ? 'Occupied (Active)' : 'Available (Empty)'}</span>
            <span className="wh-kpi-sub">{totalSerialsCount} Serial Numbers Allocated</span>
          </div>
        </div>
      </div>

      {/* 5. CONTAINED INVENTORY PRODUCTS TABLE / CARDS SECTION */}
      <div className="wh-detail-content-card">
        <div className="wh-detail-content-header">
          <div className="wh-content-title-wrap">
            <h3 className="wh-content-title">
              <Package size={17} style={{ color: '#2563eb' }} />
              <span>Contained Inventory Products</span>
              <span className="wh-content-count-pill">{assignedProducts.length}</span>
            </h3>
            <span className="wh-content-subtitle">
              All physical hardware units and tracked serials currently mapped to <strong>{box.name}</strong>
            </span>
          </div>

          {assignedProducts.length > 0 && (
            <div className="wh-content-header-stats mono">
              <span>Total Value: <strong>{formatCurrency(totalValuation)}</strong></span>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!isOccupied || assignedProducts.length === 0 ? (
          <div className="wh-detail-empty-state">
            <div className="wh-empty-icon-wrap">
              <Box size={44} style={{ color: '#94a3b8' }} />
            </div>
            <h4 className="wh-empty-title">This Storage Bin is Currently Empty</h4>
            <p className="wh-empty-desc">
              No hardware products or serial numbers are currently assigned to coordinate <strong>{locationCode}</strong>.
            </p>
            <button
              type="button"
              className="wh-btn wh-btn-primary"
              onClick={() => setShowAssignModal(true)}
              style={{ marginTop: '12px' }}
            >
              <Plus size={14} /> Assign First Product to Bin
            </button>
          </div>
        ) : (
          <div className="wh-detail-products-container">
            {/* Built Structured Table */}
            <div className="wh-detail-table-wrap">
              <table className="wh-detail-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%', textAlign: 'center' }}>#</th>
                    <th style={{ width: '30%', textAlign: 'left' }}>PRODUCT NAME / MODEL</th>
                    <th style={{ width: '16%', textAlign: 'left' }}>SKU &amp; ATTRIBUTES</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>STOCK ON HAND</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>UNIT COST</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>TOTAL VALUATION</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedProducts.map((prod, pIdx) => {
                    const prodSerials = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
                    const hasSerials = prod.serialized && prodSerials.length > 0;
                    const isSelected = selectedProductForSerials === prod.id || (!selectedProductForSerials && pIdx === 0);

                    return (
                      <React.Fragment key={prod.id || pIdx}>
                        <tr className={`wh-table-row ${isSelected ? 'row-active' : ''}`}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{pIdx + 1}</td>
                          <td>
                            <div className="wh-prod-name-cell">
                              <strong className="wh-prod-primary-name">{prod.name}</strong>
                              {prod.isLowStock && (
                                <span className="wh-low-stock-alert">Low Stock Alert</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="wh-sku-tag mono">{prod.code}</div>
                            {prod.serialized && (
                              <span className="wh-serialized-badge">Serialized Unit</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="wh-stock-badge mono">{prod.stock} Units</span>
                          </td>
                          <td style={{ textAlign: 'right', color: '#475569' }} className="mono">
                            {formatCurrency(prod.cost)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#047857', fontWeight: 700 }} className="mono">
                            {formatCurrency(prod.stock * prod.cost)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {hasSerials && (
                                <button
                                  type="button"
                                  className={`wh-table-action-pill ${selectedProductForSerials === prod.id ? 'active' : ''}`}
                                  onClick={() => setSelectedProductForSerials(selectedProductForSerials === prod.id ? null : prod.id)}
                                  title="Toggle Serial Numbers Tray"
                                >
                                  <Tag size={12} />
                                  <span>{prodSerials.length} Serials</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="wh-table-action-btn"
                                onClick={() => {
                                  setTransferProductId(prod.id);
                                  setShowTransferModal(true);
                                }}
                                title="Relocate this product to another bin"
                              >
                                <Move size={12} />
                                <span>Move</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Stored Serial Numbers Tray for This Product */}
                        {hasSerials && (
                          <tr className="wh-serials-expand-row">
                            <td colSpan={7} style={{ padding: 0 }}>
                              <div className="wh-detail-serials-tray">
                                <div className="wh-serials-tray-header">
                                  <div className="wh-serials-title-row">
                                    <Tag size={13} style={{ color: '#7c3aed' }} />
                                    <strong style={{ fontSize: '12px', color: '#334155' }}>
                                      Stored Serial Numbers for "{prod.name}" ({prodSerials.length} Units):
                                    </strong>
                                  </div>

                                  <div className="wh-serials-tray-controls">
                                    <div className="wh-serials-search-wrap">
                                      <Search size={12} style={{ color: '#94a3b8' }} />
                                      <input
                                        type="text"
                                        className="wh-serials-search-input"
                                        placeholder="Filter serials..."
                                        value={selectedProductForSerials === prod.id ? serialFilter : ''}
                                        onChange={(e) => {
                                          setSelectedProductForSerials(prod.id);
                                          setSerialFilter(e.target.value);
                                        }}
                                      />
                                      {serialFilter && selectedProductForSerials === prod.id && (
                                        <button
                                          type="button"
                                          className="wh-serials-search-clear"
                                          onClick={() => setSerialFilter('')}
                                        >
                                          <X size={11} />
                                        </button>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      className="wh-btn wh-btn-secondary compact"
                                      onClick={(e) => handleCopyAllSerials(prodSerials, e)}
                                      title="Copy all serials to clipboard"
                                    >
                                      {copiedSerial === 'ALL' ? (
                                        <Check size={12} style={{ color: '#16a34a' }} />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                      <span>{copiedSerial === 'ALL' ? 'All Copied' : 'Copy All'}</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="wh-serials-pills-grid custom-wh-scrollbar">
                                  {prodSerials
                                    .filter((sn) =>
                                      selectedProductForSerials === prod.id && serialFilter
                                        ? String(sn).toLowerCase().includes(serialFilter.toLowerCase())
                                        : true
                                    )
                                    .map((sn, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="wh-sn-detail-pill mono"
                                        onClick={() => navigate(`/serials?q=${encodeURIComponent(sn)}`)}
                                        title="Click to track complete serial provenance & sales order in Serial Tracking"
                                      >
                                        <span className="wh-sn-text">{sn}</span>
                                        <button
                                          type="button"
                                          className="wh-sn-copy-icon"
                                          onClick={(e) => handleCopySingleSerial(sn, e)}
                                          title="Copy serial number"
                                        >
                                          {copiedSerial === sn ? (
                                            <Check size={11} style={{ color: '#16a34a' }} />
                                          ) : (
                                            <Copy size={11} />
                                          )}
                                        </button>
                                        <ExternalLink size={10} className="wh-sn-ext" />
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. ASSIGN NEW PRODUCT MODAL */}
      {showAssignModal && (
        <div className="wh-modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="wh-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Assign Product to Bin: {box.name}</h3>
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
                  <strong> {box.name}</strong> ({rack?.name} › {shelf?.name}).
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

      {/* 7. RELOCATE / TRANSFER STOCK MODAL */}
      {showTransferModal && (
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
                  <strong>{box.name} ({rack?.name} › {shelf?.name})</strong>
                </div>

                <div className="wh-form-field">
                  <label className="wh-form-label">Product to Move:</label>
                  <select
                    className="wh-form-select"
                    value={transferProductId}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    required
                  >
                    {assignedProducts.map((p) => (
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
                    {allWarehouses.map((wh) =>
                      wh.layout?.floors?.map((fl) =>
                        fl.racks?.map((rk) =>
                          rk.shelves?.map((sh) =>
                            sh.boxes?.map((b) => (
                              <option key={b.id} value={b.id}>
                                {wh.name} › {fl.name} › {rk.name} › {sh.name} › {b.name}
                              </option>
                            ))
                          )
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

      {/* 8. PRINT BIN QR / BARCODE LABEL MODAL */}
      {showQrPrintModal && (
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
                  <span className="sticker-facility">{warehouse?.name}</span>
                </div>
                <div className="sticker-barcode-zone">
                  <Barcode size={48} />
                  <span className="sticker-code mono">
                    {locationCode}
                  </span>
                </div>
                <div className="sticker-details">
                  <div className="sticker-bin-name">{box.name}</div>
                  <div className="sticker-path">
                    {floor?.name} › {rack?.name} › {shelf?.name}
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
                <Printer size={14} /> Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
