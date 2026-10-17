import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
  ArrowLeft,
  Truck,
  Printer,
  FileDown,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  PackageCheck,
  FileText,
  Edit,
  Send
} from 'lucide-react';
import PrintablePurchaseOrder from '../documents/PrintablePurchaseOrder';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import DocumentPrintService from '../documents/DocumentPrintService';
import DocumentPdfService, { getPurchaseOrderFilename } from '../documents/DocumentPdfService';
import './purchaseOrders.css';

export default function PurchaseOrderDetail({ user, poId: propPoId, grnId: propGrnId, targetGrnId: propTargetGrnId, onBack, onOpenReceive }) {
  const [po, setPo] = useState(null);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDocPreview, setShowDocPreview] = useState(false);

  const grnSectionRef = useRef(null);
  const targetGrnRowRef = useRef(null);

  // Determine target PO and GRN
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const targetGrn = propTargetGrnId || propGrnId || (queryParams ? queryParams.get('grn') : null) || (typeof window !== 'undefined' ? window.history.state?.targetGrn : null);
  const [effectiveTargetGrn, setEffectiveTargetGrn] = useState(targetGrn);

  const [productOrigin, setProductOrigin] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const fromState = window.history.state?.returnToProduct;
        if (fromState) return fromState;
        const raw = sessionStorage.getItem('asicrm_product_origin');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleBackToProduct = () => {
    const origin = productOrigin?.product || productOrigin;
    if (origin) {
      try {
        sessionStorage.setItem('asicrm_restore_product', JSON.stringify(origin));
        sessionStorage.removeItem('asicrm_product_origin');
      } catch (e) {
        console.warn('Failed to store restore product in session:', e);
      }
    }
    navigate('/stocks/products', { state: { restoreProduct: origin } });
  };

  const fetchPoDetails = async () => {
    setLoading(true);
    setError('');
    try {
      let activePoId = propPoId;
      if (!activePoId && (propGrnId || effectiveTargetGrn)) {
        const lookupGrn = propGrnId || effectiveTargetGrn;
        const grnRes = await apiFetch(apiUrl(`/api/purchase-orders/receipts/${lookupGrn}`));
        const grnData = await grnRes.json();
        if (grnRes.ok && grnData.success) {
          if (grnData.purchaseOrder) {
            setPo(grnData.purchaseOrder);
            setGoodsReceipts(Array.isArray(grnData.purchaseOrder.goodsReceipts) && grnData.purchaseOrder.goodsReceipts.length > 0
              ? grnData.purchaseOrder.goodsReceipts
              : [grnData.data]);
            setLoading(false);
            return;
          } else if (grnData.data?.purchaseOrderId) {
            activePoId = grnData.data.purchaseOrderId;
          }
        }
      }

      if (activePoId) {
        const res = await apiFetch(apiUrl(`/api/purchase-orders/${activePoId}`));
        const data = await res.json();
        if (res.ok && data.success && data.data) {
          setPo(data.data);
          setGoodsReceipts(Array.isArray(data.goodsReceipts) ? data.goodsReceipts : []);
        } else {
          setError(data.message || 'Purchase Order not found.');
        }
      } else {
        setError('Purchase Order or Goods Receipt not found.');
      }
    } catch (err) {
      console.error('Error fetching PO details:', err);
      setError('Failed to communicate with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoDetails();
  }, [propPoId, propGrnId]);

  // Smooth scroll to highlighted GRN section
  useEffect(() => {
    if (effectiveTargetGrn && !loading && goodsReceipts.length > 0) {
      const timer = setTimeout(() => {
        if (targetGrnRowRef.current) {
          targetGrnRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (grnSectionRef.current) {
          grnSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [effectiveTargetGrn, loading, goodsReceipts]);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amt || 0));
  };

  const handlePrint = () => {
    DocumentPrintService.printElement(`printable-po-detail-${po.id}`, `PurchaseOrder_${po.id}`);
  };

  const handlePdf = () => {
    DocumentPdfService.generatePdf(`printable-po-detail-${po.id}`, getPurchaseOrderFilename(po));
  };

  const [sendLoading, setSendLoading] = useState(false);

  const handleSendPo = async () => {
    if (!po?.id) return;
    if (!window.confirm(`Are you sure you want to mark Purchase Order ${po.id} as SENT to supplier?`)) return;
    setSendLoading(true);
    try {
      const res = await apiFetch(apiUrl(`/api/purchase-orders/${po.id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchPoDetails();
      } else {
        alert(data.message || 'Failed to update PO status');
      }
    } catch (err) {
      console.error('Error sending PO:', err);
      alert('Failed to communicate with server');
    } finally {
      setSendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="po-container">
        <div style={{ padding: '64px', textAlign: 'center', color: '#64748b' }}>
          Loading document details...
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="po-container">
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontWeight: 600 }}>{error || 'Document Not Found'}</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            {productOrigin && (
              <button
                type="button"
                className="crm-btn-primary"
                onClick={handleBackToProduct}
              >
                ← Back to Product
              </button>
            )}
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={() => (onBack ? onBack() : navigate('/purchase-orders'))}
            >
              ← Back to Purchase Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  const supplier = po.supplierSnapshot || {};
  const items = Array.isArray(po.items) ? po.items : [];
  const statusClass = String(po.status || 'draft').toLowerCase();
  const canReceive = (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (po.totalPendingQty > 0);

  return (
    <div className="po-container purchase-order-page">
      {/* Top Bar */}
      <div className="po-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {productOrigin ? (
            <button
              type="button"
              className="crm-btn-secondary po-back-to-product-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontWeight: 600,
                color: '#1d4ed8',
                background: '#eff6ff',
                borderColor: '#bfdbfe',
                cursor: 'pointer'
              }}
              onClick={handleBackToProduct}
              title={`Return to Product Details (${productOrigin.productName || productOrigin.productCode || 'Product'})`}
            >
              <ArrowLeft size={16} /> ← Back to Product {productOrigin.productCode ? `(${productOrigin.productCode})` : ''}
            </button>
          ) : (
            <button
              type="button"
              className="crm-btn-secondary"
              style={{ padding: '6px 12px' }}
              onClick={() => (onBack ? onBack() : navigate('/purchase-orders'))}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          {productOrigin && (
            <button
              type="button"
              className="crm-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', color: '#64748b' }}
              onClick={() => (onBack ? onBack() : navigate('/purchase-orders'))}
              title="Return to Purchase Orders list"
            >
              All POs
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0 }}>{po.id}</h1>
              <span className={`po-status-badge ${statusClass}`}>
                {String(po.status || 'DRAFT').replace('_', ' ')}
              </span>
            </div>
            <p>Created on {formatDate(po.createdAt)} · Supplier: {supplier.companyName || 'Supplier'}</p>
          </div>
        </div>

        <div className="po-header-actions">
          {po.status === 'DRAFT' && (
            <>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
              >
                <Edit size={16} /> Edit PO
              </button>
              <button
                type="button"
                className="crm-btn-primary"
                onClick={handleSendPo}
                disabled={sendLoading}
              >
                <Send size={16} /> {sendLoading ? 'Sending…' : 'Send to Supplier'}
              </button>
            </>
          )}
          {canReceive && (
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => (onOpenReceive ? onOpenReceive(po.id) : navigate(`/purchase-orders/${po.id}/receive`))}
            >
              <Truck size={16} /> Receive Goods
            </button>
          )}
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => setShowDocPreview(true)}
          >
            <Printer size={16} /> Print / PDF Document
          </button>
        </div>
      </div>

      {/* PO Overview Card */}
      <div className="po-detail-header-card">
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                SUPPLIER &amp; CONTACT
              </div>
              <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', color: '#0f172a' }}>
                <a
                  href={`/purchase-orders/suppliers/${encodeURIComponent(po.supplierId || supplier.id || supplier.companyName)}`}
                  onClick={(e) => {
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                      e.preventDefault();
                      navigate(`/purchase-orders/suppliers/${encodeURIComponent(po.supplierId || supplier.id || supplier.companyName)}`);
                    }
                  }}
                  style={{ color: '#1d4ed8', textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title={`View history for ${supplier.companyName || 'Supplier'}`}
                >
                  {supplier.companyName || 'Supplier'}
                  <span style={{ fontSize: '14px', color: '#64748b' }}>→</span>
                </a>
              </h3>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                {supplier.contactPerson && <span>Attn: {supplier.contactPerson} · </span>}
                {supplier.phone && <span>Ph: {supplier.phone} · </span>}
                {supplier.email && <span>{supplier.email}</span>}
              </div>
              {supplier.gstin && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  GSTIN: {supplier.gstin}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                ORDER TOTAL
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
                {formatCurrency(po.grandTotal)}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                <span><strong>Ordered:</strong> {po.totalOrderedQty || 0}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ color: '#16a34a' }}><strong>Received:</strong> {po.totalReceivedQty || 0}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ color: (po.totalPendingQty || 0) > 0 ? '#d97706' : '#16a34a' }}><strong>Pending:</strong> {po.totalPendingQty || 0}</span>
              </div>
            </div>
          </div>

          <div className="po-detail-grid">
            <div className="po-detail-field">
              <span>Order Date</span>
              <strong>{formatDate(po.orderDate)}</strong>
            </div>
            <div className="po-detail-field">
              <span>Delivery Due</span>
              <strong>{formatDate(po.expectedDeliveryDate)}</strong>
            </div>
            <div className="po-detail-field">
              <span>Payment Terms</span>
              <strong>{po.paymentTerms || 'Net 30 Days'}</strong>
            </div>
            <div className="po-detail-field">
              <span>Delivery Address</span>
              <strong style={{ fontSize: '12px' }}>{po.deliveryAddress}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Ordered Line Items Card */}
      <div className="po-editor-card">
        <div className="po-section-title">
          <FileText size={18} /> Ordered Products &amp; Receipt Status
        </div>

        <div className="po-grid-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th style={{ width: '32px', textAlign: 'center' }}>#</th>
                <th>PRODUCT / SKU</th>
                <th style={{ width: '100px' }}>CATEGORY</th>
                <th style={{ width: '90px' }}>BRAND</th>
                <th style={{ width: '60px', textAlign: 'center' }}>UNIT</th>
                <th style={{ width: '70px', textAlign: 'right' }}>ORDERED</th>
                <th style={{ width: '70px', textAlign: 'right' }}>RECEIVED</th>
                <th style={{ width: '105px', textAlign: 'right' }} title="Purchase Rate per Product / Unit (₹)">
                  RATE (₹)
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 600, color: '#64748b', textTransform: 'none', letterSpacing: 'normal' }}>
                    (per product)
                  </span>
                </th>
                <th style={{ width: '60px', textAlign: 'center' }}>GST%</th>
                <th style={{ width: '80px', textAlign: 'right' }}>TAX</th>
                <th style={{ width: '105px', textAlign: 'right' }}>LINE TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const ord = Number(it.orderedQty || 0);
                const rec = Number(it.receivedQty || 0);
                const pend = Math.max(0, ord - rec);
                const taxAmt = Number(it.tax !== undefined ? it.tax : ((ord * Number(it.rate || 0) * Number(it.gstRate || 18)) / 100).toFixed(2));

                return (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Code: {it.productCode} {it.serialized ? ' · Serialized Item' : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569' }}>
                      {it.category || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569' }}>
                      {it.brand || '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px' }}>
                      {(it.unit && it.unit !== 'Piece') ? it.unit : 'Nos'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{ord}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: rec > 0 ? '#16a34a' : '#64748b' }}>
                      {rec}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: pend > 0 ? '#d97706' : '#16a34a' }}>
                      {pend}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div>₹{Number(it.rate || 0).toFixed(2)}</div>
                      {it.receiptBatches && it.receiptBatches.length > 1 && (
                        <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                          Highest Rate
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{it.gstRate || 18}%</td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>₹{taxAmt.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <div>₹{Number(it.valuationTotal || it.lineTotal || 0).toFixed(2)}</div>
                      {it.receiptBatches && it.receiptBatches.length > 1 && (
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          Actual: ₹{Number(it.actualCostTotal || 0).toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Profit Protection Cost Analysis */}
        {po.profitProtectionBuffer > 0 && (
          <div className="profit-protection-banner" style={{
            marginTop: '16px',
            padding: '12px 18px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Profit Protection Rule Active (Highest Price Benchmark)
              </div>
              <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                Actual amount billed across delivery batches: <strong>₹{po.actualCostTotal?.toFixed(2)}</strong>. Total valuation benchmarked at the highest received unit price to protect against margin loss: <strong>₹{po.subtotal?.toFixed(2)}</strong>.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Protected Margin Buffer</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>
                +₹{po.profitProtectionBuffer?.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Totals Summary */}
        <div className="po-totals-container" style={{ marginTop: '16px' }}>
          <div className="po-totals-box">
            <div className="po-total-row">
              <span>Subtotal (Taxable):</span>
              <strong>₹{Number(po.subtotal || 0).toFixed(2)}</strong>
            </div>
            {po.igst > 0 ? (
              <div className="po-total-row">
                <span>IGST (Inter-State):</span>
                <span>₹{Number(po.igst || 0).toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="po-total-row">
                  <span>CGST (Intra-State):</span>
                  <span>₹{Number(po.cgst || 0).toFixed(2)}</span>
                </div>
                <div className="po-total-row">
                  <span>SGST (Intra-State):</span>
                  <span>₹{Number(po.sgst || 0).toFixed(2)}</span>
                </div>
              </>
            )}
            {po.roundOff !== undefined && Number(po.roundOff) !== 0 && (
              <div className="po-total-row">
                <span>Round Off:</span>
                <span>{Number(po.roundOff) > 0 ? `+₹${Number(po.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(po.roundOff)).toFixed(2)}`}</span>
              </div>
            )}
            <div className="po-total-row grand-total">
              <span>Grand Total:</span>
              <span>₹{Number(po.grandTotal || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goods Receipt History (GRNs) Card */}
      <div className="po-editor-card" ref={grnSectionRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="po-section-title" style={{ margin: 0, border: 'none' }}>
            <PackageCheck size={18} /> Goods Receipt History (GRNs)
          </div>
          {canReceive && (
            <button
              type="button"
              className="crm-btn-primary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => (onOpenReceive ? onOpenReceive(po.id) : navigate(`/purchase-orders/${po.id}/receive`))}
            >
              <Truck size={14} /> + Receive More Goods
            </button>
          )}
        </div>

        {effectiveTargetGrn && (
          <div className="po-grn-focus-banner" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            marginBottom: '14px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            fontSize: '12.5px',
            color: '#166534'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>Focused Goods Receipt: <strong style={{ fontFamily: 'monospace' }}>{effectiveTargetGrn}</strong></span>
            </div>
            {productOrigin && (
              <button
                type="button"
                onClick={handleBackToProduct}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#15803d',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ← Back to Product Details
              </button>
            )}
          </div>
        )}

        {goodsReceipts.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No goods have been received against this purchase order yet.</p>
            {canReceive && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#2563eb' }}>
                Click "Receive Goods" once physical products arrive at the warehouse.
              </p>
            )}
          </div>
        ) : (
          <div className="po-grid-table-wrap">
            <table className="po-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>GRN NUMBER</th>
                  <th style={{ width: '110px' }}>RECEIPT DATE</th>
                  <th>RECEIVED ITEMS &amp; QUANTITIES</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>TOTAL RECEIVED</th>
                  <th style={{ width: '120px' }}>RECEIVED BY</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {goodsReceipts.map((grn) => {
                  const isTarget = Boolean(effectiveTargetGrn && (grn.id === effectiveTargetGrn || grn.grnId === effectiveTargetGrn));
                  return (
                    <tr
                      key={grn.id}
                      ref={isTarget ? targetGrnRowRef : null}
                      className={isTarget ? 'po-grn-row-target' : ''}
                      style={isTarget ? { background: '#f0fdf4', outline: '2px solid #22c55e', outlineOffset: '-2px' } : {}}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: isTarget ? '#15803d' : '#2563eb' }}>
                            {grn.id}
                          </span>
                          {isTarget && (
                            <span
                              style={{
                                background: '#22c55e',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                letterSpacing: '0.02em'
                              }}
                            >
                              SELECTED
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(grn.receivedDate)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(grn.items || []).map((it, i) => (
                            <div key={i} style={{ fontSize: '12px' }}>
                              <strong>{it.productName}</strong>: +{it.quantity || it.receiveNow} units
                              {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                                <div className="po-serial-tags">
                                  {it.serialNumbers.map((sn, sIdx) => (
                                    <span key={sIdx} className="po-serial-tag">{sn}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        +{grn.totalReceivedQty || 0}
                      </td>
                      <td>{grn.receivedBy || 'Store Officer'}</td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{grn.notes || '—'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Print & PDF Modal */}
      {showDocPreview && (
        <DocumentPreviewModal
          title="Purchase Order"
          docId={po.id || po.poNumber}
          docType="po"
          status={po.status}
          filename={getPurchaseOrderFilename(po)}
          data={po}
          onClose={() => setShowDocPreview(false)}
        >
          <PrintablePurchaseOrder purchaseOrder={po} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
