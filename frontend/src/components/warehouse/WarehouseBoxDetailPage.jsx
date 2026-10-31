import React, { useState, useMemo, useEffect } from 'react';
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
  X,
  Info
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

  // Serial Info Modal state ("i" button / popup)
  const [serialModalProduct, setSerialModalProduct] = useState(null);
  const [serialModalSearch, setSerialModalSearch] = useState('');
  const [modalCopiedSerial, setModalCopiedSerial] = useState('');

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

  // Serial Info Modal Handlers
  const openSerialsModal = (prod) => {
    setSerialModalProduct(prod);
    setSerialModalSearch('');
    setModalCopiedSerial('');
  };

  const closeSerialsModal = () => {
    setSerialModalProduct(null);
    setSerialModalSearch('');
    setModalCopiedSerial('');
  };

  const handleCopyModalSingleSerial = (sn, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!sn) return;
    navigator.clipboard?.writeText(String(sn).trim());
    setModalCopiedSerial(sn);
    setTimeout(() => setModalCopiedSerial(''), 1800);
  };

  const handleCopyModalAllSerials = (serials, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!serials || serials.length === 0) return;
    const text = serials.join(', ');
    navigator.clipboard?.writeText(text);
    setModalCopiedSerial('ALL');
    setTimeout(() => setModalCopiedSerial(''), 2000);
  };

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (serialModalProduct) closeSerialsModal();
        if (showAssignModal) setShowAssignModal(false);
        if (showTransferModal) setShowTransferModal(false);
        if (showQrPrintModal) setShowQrPrintModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [serialModalProduct, showAssignModal, showTransferModal, showQrPrintModal]);

  // Derived serials for active modal
  const modalSerials = useMemo(() => {
    if (!serialModalProduct) return [];
    return Array.isArray(serialModalProduct.serialNumbers)
      ? serialModalProduct.serialNumbers
      : (typeof serialModalProduct.serialNumbers === 'string' && serialModalProduct.serialNumbers.trim()
          ? serialModalProduct.serialNumbers.split(',').map(s => s.trim()).filter(Boolean)
          : []);
  }, [serialModalProduct]);

  const filteredModalSerials = useMemo(() => {
    if (!serialModalSearch.trim()) return modalSerials;
    const q = serialModalSearch.toLowerCase().trim();
    return modalSerials.filter((sn) => String(sn).toLowerCase().includes(q));
  }, [modalSerials, serialModalSearch]);

  const isLargeModal = modalSerials.length > 10;

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
                    const prodSerials = Array.isArray(prod.serialNumbers)
                      ? prod.serialNumbers
                      : (typeof prod.serialNumbers === 'string' && prod.serialNumbers.trim()
                          ? prod.serialNumbers.split(',').map(s => s.trim()).filter(Boolean)
                          : []);
                    const hasSerials = prod.serialized && prodSerials.length > 0;

                    return (
                      <tr key={prod.id || pIdx} className="wh-table-row">
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
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span className="wh-serialized-badge">Serialized Unit</span>
                              {hasSerials ? (
                                <button
                                  type="button"
                                  className="wh-serial-info-icon-btn"
                                  onClick={() => openSerialsModal(prod)}
                                  title={`View ${prodSerials.length} serial numbers for ${prod.name}`}
                                  aria-label="View Serial Numbers Info"
                                >
                                  <Info size={12} />
                                </button>
                              ) : (
                                <span
                                  className="wh-serial-info-icon-btn disabled"
                                  title="No serials currently in this bin"
                                >
                                  <Info size={12} />
                                </span>
                              )}
                            </div>
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
                                className="wh-table-action-pill wh-serial-info-pill"
                                onClick={() => openSerialsModal(prod)}
                                title={`View and manage ${prodSerials.length} serial numbers in popup`}
                              >
                                <Info size={12} />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. DEDICATED SERIAL NUMBERS POPUP MODAL ("i" button popup) */}
      {serialModalProduct && (
        <div className="wh-modal-overlay" onClick={closeSerialsModal}>
          <div
            className={`wh-modal-dialog wh-serials-modal-dialog ${isLargeModal ? 'large-dialog' : 'compact-dialog'}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="serial-modal-title"
          >
            {/* Modal Header */}
            <div className="wh-modal-header wh-serials-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="wh-serials-modal-icon-badge">
                  <Info size={18} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <h3 id="serial-modal-title" style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{serialModalProduct.name}</span>
                    <span className="wh-serials-modal-count-badge">
                      {modalSerials.length} {modalSerials.length === 1 ? 'Serial Unit' : 'Serial Units'}
                    </span>
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    📍 <strong>Storage Coordinate:</strong> {box.name} ({box.code}) • {rack?.name} › {shelf?.name}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="wh-modal-close"
                onClick={closeSerialsModal}
                title="Close (Esc)"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="wh-modal-body wh-serials-modal-body">
              {/* Search & Actions Toolbar */}
              <div className="wh-serials-modal-toolbar">
                <div className="wh-serials-modal-search">
                  <Search size={14} style={{ color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search serial number..."
                    value={serialModalSearch}
                    onChange={(e) => setSerialModalSearch(e.target.value)}
                    autoFocus
                  />
                  {serialModalSearch && (
                    <button
                      type="button"
                      className="wh-serials-search-clear"
                      onClick={() => setSerialModalSearch('')}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    {filteredModalSerials.length} of {modalSerials.length}
                  </span>
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary compact"
                    onClick={(e) => handleCopyModalAllSerials(filteredModalSerials, e)}
                    title="Copy all visible serial numbers to clipboard"
                  >
                    {modalCopiedSerial === 'ALL' ? (
                      <Check size={13} style={{ color: '#16a34a' }} />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{modalCopiedSerial === 'ALL' ? 'All Copied!' : 'Copy All'}</span>
                  </button>
                </div>
              </div>

              {/* Serials Grid */}
              {filteredModalSerials.length === 0 ? (
                <div className="wh-serials-modal-empty">
                  <Search size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>
                    No serial numbers match "{serialModalSearch}"
                  </div>
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary compact"
                    style={{ marginTop: '10px' }}
                    onClick={() => setSerialModalSearch('')}
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <div className={`wh-serials-modal-grid custom-wh-scrollbar ${isLargeModal ? 'grid-multi-col' : 'grid-compact'}`}>
                  {filteredModalSerials.map((sn, sIdx) => {
                    const isCopied = modalCopiedSerial === sn;
                    return (
                      <div
                        key={sIdx}
                        className="wh-serial-card"
                        onClick={() => navigate(`/serials?q=${encodeURIComponent(sn)}`)}
                        title="Click to track complete serial provenance & sales order in Serial Tracking"
                      >
                        <div className="wh-serial-card-num mono">{sn}</div>
                        <div className="wh-serial-card-meta">
                          <span className="wh-serial-card-status">● In Bin Stock</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="wh-serial-card-copy-btn"
                              onClick={(e) => handleCopyModalSingleSerial(sn, e)}
                              title="Copy serial number"
                            >
                              {isCopied ? (
                                <Check size={12} style={{ color: '#16a34a' }} />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            <ExternalLink size={11} className="wh-serial-card-link-icon" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="wh-modal-footer wh-serials-modal-footer">
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                💡 <em>Click any serial card to view its full lifecycle tracking &amp; audit history.</em>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={closeSerialsModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ASSIGN NEW PRODUCT MODAL */}
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
