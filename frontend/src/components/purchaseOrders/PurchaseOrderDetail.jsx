import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [previewMode, setPreviewMode] = useState('ALL');
  const [previewHidePrices, setPreviewHidePrices] = useState(false);

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

  const items = useMemo(() => (Array.isArray(po?.items) ? po.items : []), [po?.items]);

  const tableTotals = useMemo(() => {
    let ordQty = 0;
    let recQty = 0;
    let pendQty = 0;
    let totalTax = 0;
    let totalLine = 0;
    let totalTaxable = 0;

    items.forEach((it) => {
      const ord = Number(it.orderedQty !== undefined ? it.orderedQty : (it.quantity !== undefined ? it.quantity : (it.qty || 0)));
      const rec = Number(it.receivedQty || 0);
      const pend = Math.max(0, ord - rec);
      const rate = Number(it.unitRate !== undefined ? it.unitRate : (it.rate !== undefined ? it.rate : (it.unitPrice || it.price || it.costPrice || 0)));
      const gstRate = Number(it.gstRate || it.gst || 18);
      const taxable = Number(it.taxableValue !== undefined && it.taxableValue > 0 ? it.taxableValue : (it.totalValue !== undefined && it.totalValue > 0 ? it.totalValue : (ord * rate).toFixed(2)));
      const taxAmt = Number(it.tax !== undefined && it.tax > 0 ? it.tax : (it.taxAmount !== undefined && it.taxAmount > 0 ? it.taxAmount : ((taxable * gstRate) / 100).toFixed(2)));
      const lineVal = Number(it.valuationTotal || it.lineTotal || (taxable + taxAmt));

      ordQty += ord;
      recQty += rec;
      pendQty += pend;
      totalTaxable += taxable;
      totalTax += taxAmt;
      totalLine += lineVal;
    });

    return {
      orderedQty: ordQty,
      receivedQty: recQty,
      pendingQty: pendQty,
      taxable: totalTaxable,
      tax: totalTax,
      lineTotal: totalLine
    };
  }, [items]);

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

  const supplier = po?.supplierSnapshot || {};
  const statusClass = String(po?.status || 'draft').toLowerCase();
  const canReceive = (po?.status === 'SENT' || po?.status === 'PARTIALLY_RECEIVED') && (po?.totalPendingQty > 0);

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
            onClick={() => {
              setPreviewMode('ALL');
              setPreviewHidePrices(false);
              setShowDocPreview(true);
            }}
          >
            <Printer size={16} /> Print / PDF Document
          </button>
          <button
            type="button"
            className="crm-btn-secondary"
            style={{ color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
            onClick={() => {
              setPreviewMode('ALL');
              setPreviewHidePrices(true);
              setShowDocPreview(true);
            }}
            title="Print or view Purchase Order Vendor Copy"
          >
            <FileText size={16} /> Vendor Copy
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
                {Number(po.totalPendingQty || 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/purchase-orders/${po.id}/receive`)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      color: '#b45309',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Click to receive remaining pending items"
                  >
                    <span>⚡ Pending: {po.totalPendingQty}</span>
                    <span style={{ fontSize: '11px', textDecoration: 'underline' }}>Receive →</span>
                  </button>
                ) : (
                  <span style={{ color: '#16a34a' }}><strong>Pending:</strong> 0</span>
                )}
              </div>
              <div style={{ marginTop: '8px' }}>
                {po.status === 'RECEIVED' ? (
                  <span className="po-status-badge received">✓ FULLY RECEIVED</span>
                ) : po.status === 'PARTIALLY_RECEIVED' ? (
                  <button
                    type="button"
                    className="po-reactive-pending-badge"
                    onClick={() => navigate(`/purchase-orders/${po.id}/receive`)}
                    title="Click to receive remaining goods for this order"
                  >
                    <span>⚡ PARTIALLY RECEIVED</span>
                    <span className="badge-units">+{po.totalPendingQty || 0} Pending</span>
                  </button>
                ) : (
                  <span className={`po-status-badge ${String(po.status || 'draft').toLowerCase()}`}>
                    {String(po.status || 'DRAFT').replace('_', ' ')}
                  </span>
                )}
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
              <span>Payment Status</span>
              <strong style={{ color: Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? '#15803d' : (Number(po.totalPaid || 0) > 0 ? '#b45309' : '#0f172a') }}>
                {Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? 'Fully Paid' : (Number(po.totalPaid || 0) > 0 ? `Paid ₹${Number(po.totalPaid || 0).toLocaleString('en-IN')} (Due: ₹${Number(po.balanceAmount !== undefined ? po.balanceAmount : Math.max(0, (po.grandTotal || 0) - (po.totalPaid || 0))).toLocaleString('en-IN')})` : 'Unpaid (Due on Terms)')}
              </strong>
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

        <div className="po-grid-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="po-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left', paddingLeft: '8px' }}>PRODUCT / SKU</th>
                <th style={{ textAlign: 'left' }}>CATEGORY</th>
                <th style={{ textAlign: 'left' }}>BRAND</th>
                <th style={{ textAlign: 'center' }}>UNIT</th>
                <th style={{ textAlign: 'center' }}>ORDERED</th>
                <th style={{ textAlign: 'center', color: '#16a34a' }}>RECEIVED</th>
                <th style={{ textAlign: 'center', color: '#d97706' }}>PENDING</th>
                <th style={{ textAlign: 'right' }} title="Purchase Rate per Product / Unit (₹)">
                  RATE (₹)
                  <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#64748b', textTransform: 'none' }}>
                    (per unit)
                  </span>
                </th>
                <th style={{ textAlign: 'center' }}>GST%</th>
                <th style={{ textAlign: 'right' }}>TAX (₹)</th>
                <th style={{ textAlign: 'right' }}>LINE TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const ord = Number(it.orderedQty !== undefined ? it.orderedQty : (it.quantity !== undefined ? it.quantity : (it.qty || 0)));
                const rec = Number(it.receivedQty || 0);
                const pend = Math.max(0, ord - rec);
                const rate = Number(it.unitRate !== undefined ? it.unitRate : (it.rate !== undefined ? it.rate : (it.unitPrice || it.price || it.costPrice || 0)));
                const gstRate = Number(it.gstRate || it.gst || 18);
                const taxable = Number(it.taxableValue !== undefined && it.taxableValue > 0 ? it.taxableValue : (it.totalValue !== undefined && it.totalValue > 0 ? it.totalValue : (ord * rate).toFixed(2)));
                const taxAmt = Number(it.tax !== undefined && it.tax > 0 ? it.tax : (it.taxAmount !== undefined && it.taxAmount > 0 ? it.taxAmount : ((taxable * gstRate) / 100).toFixed(2)));
                const lineTotalVal = Number(it.valuationTotal || it.lineTotal || (taxable + taxAmt));

                return (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{it.productName}</div>
                      {it.description ? (
                        <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                          {it.description}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569', textAlign: 'left' }}>
                      {it.category || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569', textAlign: 'left' }}>
                      {it.brand || '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600 }}>
                      {(it.unit && it.unit !== 'Piece') ? it.unit : 'Nos'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                      {ord}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', color: rec > 0 ? '#16a34a' : '#94a3b8' }}>
                      {rec}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>
                      {pend > 0 ? (
                        <span style={{ color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          {pend}
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12.5px' }}>
                      <div>₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      {it.receiptBatches && it.receiptBatches.length > 1 && (
                        <div style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700 }}>
                          Highest Rate
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>
                      {gstRate}%
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12.5px', color: '#475569' }}>
                      ₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                      <div>₹{lineTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      {it.receiptBatches && it.receiptBatches.length > 1 && (
                        <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                          Actual: ₹{Number(it.actualCostTotal || 0).toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                <td colSpan="5" style={{ textAlign: 'right', fontWeight: 800, padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.02em' }}>
                  TOTALS :
                </td>
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                  {tableTotals.orderedQty}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#16a34a' }}>
                  {tableTotals.receivedQty}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: tableTotals.pendingQty > 0 ? '#b45309' : '#16a34a' }}>
                  {tableTotals.pendingQty}
                </td>
                <td style={{ textAlign: 'right', color: '#94a3b8' }}>—</td>
                <td style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '12.5px', color: '#475569' }}>
                  ₹{tableTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '13.5px', color: '#0f172a' }}>
                  ₹{tableTotals.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
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
        <div className="po-totals-container" style={{ marginTop: '20px' }}>
          <div className="po-totals-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px 20px', width: '360px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="po-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#475569' }}>
              <span>Subtotal (Taxable):</span>
              <strong style={{ fontFamily: 'monospace', color: '#0f172a', fontSize: '13px' }}>
                ₹{Number(po.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            {po.igst > 0 ? (
              <div className="po-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#475569' }}>
                <span>IGST (Inter-State):</span>
                <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                  ₹{Number(po.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <>
                <div className="po-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#475569' }}>
                  <span>CGST (Intra-State 9%):</span>
                  <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                    ₹{Number(po.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="po-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#475569' }}>
                  <span>SGST (Intra-State 9%):</span>
                  <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                    ₹{Number(po.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
            {po.roundOff !== undefined && Number(po.roundOff) !== 0 && (
              <div className="po-total-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#475569' }}>
                <span>Round Off:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {Number(po.roundOff) > 0 ? `+₹${Number(po.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(po.roundOff)).toFixed(2)}`}
                </span>
              </div>
            )}
            <div className="po-total-row grand-total" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: '10px', marginTop: '6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              <span>Grand Total:</span>
              <span style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>
                ₹{Number(po.grandTotal || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Inward Reconciliation Summary Pills */}
            {(po.totalReceivedQty > 0 || po.totalPendingQty > 0) && (
              <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '10px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: '4px' }}>
                  <span>✓ Goods Received to Date:</span>
                  <strong>{po.totalReceivedQty || 0} Units</strong>
                </div>
                {po.totalPendingQty > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '4px 8px', borderRadius: '4px' }}>
                    <span>⚡ Pending Delivery Balance:</span>
                    <strong>{po.totalPendingQty || 0} Units</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment & Settlement History Card */}
      <div className="po-editor-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div className="po-section-title" style={{ margin: 0, border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💳 Payment &amp; Settlement History</span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? '#dcfce7' : (Number(po.totalPaid || 0) > 0 ? '#fef3c7' : '#f1f5f9'),
              color: Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? '#15803d' : (Number(po.totalPaid || 0) > 0 ? '#b45309' : '#64748b'),
              border: `1px solid ${Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? '#86efac' : (Number(po.totalPaid || 0) > 0 ? '#fde68a' : '#cbd5e1')}`
            }}>
              {Number(po.totalPaid || 0) >= Number(po.grandTotal || 0) && Number(po.grandTotal || 0) > 0 ? '✓ Fully Paid' : (Number(po.totalPaid || 0) > 0 ? `Partially Paid (₹${Number(po.totalPaid || 0).toLocaleString('en-IN')})` : 'Unpaid')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
            <span>Total Paid: <strong style={{ color: '#16a34a' }}>₹{Number(po.totalPaid || 0).toLocaleString('en-IN')}</strong></span>
            <span>Balance Due: <strong style={{ color: '#1e3a8a' }}>₹{Number(po.balanceAmount !== undefined ? po.balanceAmount : Math.max(0, (po.grandTotal || 0) - (po.totalPaid || 0))).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        {Array.isArray(po.payments) && po.payments.length > 0 ? (
          <table className="po-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Payment Ref</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Date</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Type</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Mode</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Reference / UTR</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px' }}>Amount (₹)</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {po.payments.map((pay, pIdx) => (
                <tr key={pay.id || pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px', fontFamily: 'monospace', fontWeight: 600 }}>{pay.id || `PAY-${pIdx + 1}`}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px' }}>{formatDate(pay.date)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: pay.type === 'IMMEDIATE' ? '#e0f2fe' : (pay.type === 'ADVANCE' ? '#eff6ff' : '#f0fdf4'),
                      color: pay.type === 'IMMEDIATE' ? '#0369a1' : (pay.type === 'ADVANCE' ? '#1d4ed8' : '#166534')
                    }}>
                      {pay.type === 'IMMEDIATE' ? 'Immediate Payment' : (pay.type === 'ADVANCE' ? 'Advance Payment' : 'GRN Receipt Payment')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px' }}>
                    {pay.bankName ? `${pay.bankName} - ${pay.mode || 'Direct'}` : (pay.mode || 'Bank Transfer')}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px', color: '#64748b' }}>{pay.reference || '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    ₹{Number(pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d' }}>
                      PAID
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No payments recorded yet for this Purchase Order. Payments can be recorded during Goods Receipt (GRN) or as an advance upon PO creation.
          </div>
        )}
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
                  <th style={{ width: '110px', textAlign: 'right' }}>ACTION</th>
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
                                    <span
                                      key={sIdx}
                                      className="po-serial-tag"
                                      title={`Click to track complete serial lifecycle: ${sn}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/serials?q=${encodeURIComponent(sn)}`);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {sn}
                                    </span>
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
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 700 }}
                          onClick={() => {
                            setPreviewMode('RECEIVED_ONLY');
                            setShowDocPreview(true);
                          }}
                          title="Print Goods Receipt Note (GRN)"
                        >
                          <Printer size={12} /> Print GRN
                        </button>
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
          title={
            previewMode === 'RECEIVED_ONLY'
              ? 'Goods Receipt Note (GRN)'
              : previewHidePrices
              ? (po.status === 'PARTIALLY_RECEIVED'
                  ? 'Purchase Order - Vendor Copy (Partial Delivery)'
                  : po.status === 'RECEIVED'
                  ? 'Purchase Order - Vendor Copy (Full Delivery)'
                  : 'Purchase Order (Vendor Copy)')
              : (po.status === 'PARTIALLY_RECEIVED'
                  ? 'Purchase Order - Partial Delivery'
                  : po.status === 'RECEIVED'
                  ? 'Purchase Order - Full Delivery'
                  : 'Purchase Order')
          }
          docId={po.id || po.poNumber}
          docType="po"
          status={po.status}
          filename={
            previewHidePrices
              ? `PurchaseOrder_Vendor_${po.id || po.poNumber}.pdf`
              : getPurchaseOrderFilename(po, previewMode)
          }
          data={po}
          onClose={() => {
            setShowDocPreview(false);
            setPreviewHidePrices(false);
          }}
        >
          <PrintablePurchaseOrder
            purchaseOrder={po}
            hidePrices={previewHidePrices}
            defaultFulfillmentMode={previewMode}
          />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
