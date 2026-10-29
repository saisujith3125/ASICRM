import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, FileText, Download } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { hasPermission } from '../../utils/permissions';
import { navigate } from '../../router';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import PrintableSalesInvoice from '../documents/PrintableSalesInvoice';
import PrintableDeliveryChallan from '../documents/PrintableDeliveryChallan';
import PrintableProformaInvoice from '../documents/PrintableProformaInvoice';
import CreateProformaModal from './CreateProformaModal';
import CreateSalesInvoiceModal from './CreateSalesInvoiceModal';
import CustomerSelector from '../customer/CustomerSelector';
import { getInvoiceFilename, getDcFilename, getProformaFilename, generateInvoicePdf } from '../documents/DocumentPdfService';
import { amountInWords } from '../documents/documentFormatters';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';

const ORDER_SEARCH_EXTRACTORS = [
  (o) => o.orderId,
  (o) => o.quotationId,
  (o) => o.enquiryId,
  (o) => o.customerId,
  (o) => o.customerName,
  (o) => o.customerCompany,
  (o) => o.company,
  (o) => o.contactPerson,
  (o) => o.phone,
  (o) => o.mobile,
  (o) => o.customerPhone,
  (o) => o.email,
  (o) => o.customerEmail,
  (o) => o.status,
  (o) => o.paymentStatus,
  (o) => o.items?.map((it) => (typeof it === 'string' ? it : `${it.productName || it.name || it.title || ''} ${it.sku || ''} ${it.code || ''} ${it.description || ''}`))
];

const INVOICE_SEARCH_EXTRACTORS = [
  (inv) => inv.invoiceId,
  (inv) => inv.orderId,
  (inv) => inv.challanId,
  (inv) => inv.quotationId,
  (inv) => inv.customerName,
  (inv) => inv.customerCompany,
  (inv) => inv.company,
  (inv) => inv.contactPerson,
  (inv) => inv.phone,
  (inv) => inv.mobile,
  (inv) => inv.customerPhone,
  (inv) => inv.email,
  (inv) => inv.customerEmail,
  (inv) => inv.status,
  (inv) => inv.paymentStatus,
  (inv) => inv.paymentMode,
  (inv) => inv.gstin,
  (inv) => inv.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${it.description || ''}`)
];

const PROFORMA_SEARCH_EXTRACTORS = [
  (p) => p.proformaId,
  (p) => p.quotationId,
  (p) => p.orderId,
  (p) => p.customerPoNumber,
  (p) => p.customerName,
  (p) => p.customerCompany,
  (p) => p.company,
  (p) => p.contactPerson,
  (p) => p.phone,
  (p) => p.mobile,
  (p) => p.email,
  (p) => p.status,
  (p) => p.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${it.description || ''}`)
];

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}


function parseOrderItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.flatMap((it) => {
      if (typeof it === 'string') {
        return it.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (it && typeof it === 'object') {
        const qty = it.quantity || it.qty || '';
        const name = it.productName || it.name || it.title || '';
        return [qty ? `${qty}x ${name}` : name].filter(Boolean);
      }
      return [String(it)];
    });
  }
  if (typeof items === 'string') {
    return items.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [String(items)];
}

function formatTableDate(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

export default function OrdersView({ user, initialSubView = 'orders', activeDocId, docType, proformaCreate, onSelectEnquiry, onNavigateCustomer }) {
  const [subView, setSubView] = useState(initialSubView);
  const [orders, setOrders] = useState([]);
  const [challans, setChallans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [proformaStatusFilter, setProformaStatusFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedProformaId, setExpandedProformaId] = useState(null);
  const [openItemPopoverId, setOpenItemPopoverId] = useState(null);
  const [activeMoreMenuId, setActiveMoreMenuId] = useState(null);
  const [activeInvoiceDownloadMenuId, setActiveInvoiceDownloadMenuId] = useState(null);
  const [downloadingInvoiceState, setDownloadingInvoiceState] = useState(null); // { id, showSignature }
  const [invoiceTabFilter, setInvoiceTabFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p) {
        const up = p.toUpperCase();
        if (['UNBILLED', 'PENDING', 'PAID', 'ALL'].includes(up)) return up;
      }
    }
    return 'UNBILLED'; // Flow: 1st Pending Invoicing DCs, 2nd Pending Invoices, 3rd Paid Invoices, 4th All
  });

  // Modals state
  const [invModalData, setInvModalData] = useState(null); // { order, challan }
  const [proformaModalData, setProformaModalData] = useState(null); // { proforma, isRevision, upstreamQuotation, upstreamOrder }
  const [viewDocData, setViewDocData] = useState(null); // { type: 'DC' | 'INV' | 'PI', data }

  const canCreate = hasPermission(user, 'Orders & Deals', 'Create');
  const canEdit = hasPermission(user, 'Orders & Deals', 'Edit') || canCreate;

  const handleDownloadInvoicePdf = async (inv, showSignature) => {
    if (downloadingInvoiceState) return;
    setActiveInvoiceDownloadMenuId(null);
    setDownloadingInvoiceState({ id: inv.invoiceId, showSignature });
    try {
      await generateInvoicePdf(inv, { showSignature });
    } catch (err) {
      console.error(`${showSignature ? 'Signed' : 'Unsigned'} Invoice PDF download failed:`, err);
      alert(`Unable to generate the ${showSignature ? 'signed' : 'unsigned'} PDF. Please try again.`);
    } finally {
      setDownloadingInvoiceState(null);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      setActiveMoreMenuId(null);
      setActiveInvoiceDownloadMenuId(null);
      if (!e.target.closest('.proforma-items-cell') && !e.target.closest('.quotation-items-cell')) {
        setOpenItemPopoverId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveMoreMenuId(null);
        setActiveInvoiceDownloadMenuId(null);
        setOpenItemPopoverId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setOpenItemPopoverId(null);
  }, [search, proformaStatusFilter, subView]);

  useEffect(() => {
    if (initialSubView && initialSubView !== subView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  useEffect(() => {
    if (proformaCreate) {
      setSubView('proformas');
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const qId = params ? params.get('quotationId') : null;
      const ordId = params ? params.get('orderId') : null;

      if (qId) {
        apiFetch(apiUrl('/api/enquiries/quotations'), { headers: authHeaders(user) })
          .then((res) => res.json())
          .then((data) => {
            const list = Array.isArray(data?.data) ? data.data : [];
            const foundQ = list.find((q) => q.quotationId === qId);
            setProformaModalData({
              proforma: null,
              upstreamQuotation: foundQ || { quotationId: qId }
            });
          })
          .catch(() => {
            setProformaModalData({ proforma: null, upstreamQuotation: { quotationId: qId } });
          });
      } else if (ordId) {
        const foundOrd = orders.find((o) => o.orderId === ordId);
        setProformaModalData({
          proforma: null,
          upstreamOrder: foundOrd || { orderId: ordId }
        });
      } else {
        setProformaModalData({ proforma: null });
      }
    }
  }, [proformaCreate]);

  // Deep linking: auto-open document modal when activeDocId is provided
  useEffect(() => {
    if (!activeDocId) return;
    if (docType === 'challan' || activeDocId.startsWith('DC-')) {
      const targetDc = challans.find((c) => c.challanId === activeDocId);
      if (targetDc) {
        setViewDocData({ type: 'DC', data: targetDc });
      }
    } else if (docType === 'invoice' || docType === 'INV' || activeDocId.startsWith('INV-')) {
      const targetInv = invoices.find((i) => i.invoiceId === activeDocId);
      if (targetInv) {
        setViewDocData({ type: 'INV', data: targetInv });
      }
    } else if (docType === 'PI' || docType === 'pi' || activeDocId.startsWith('PI-')) {
      const targetPi = proformas.find((p) => p.proformaId === activeDocId || p.revisionId === activeDocId);
      if (targetPi) {
        setViewDocData({ type: 'PI', data: targetPi });
      }
    }
  }, [activeDocId, docType, challans, invoices, proformas]);

  // Deep linking: auto-open invoice creation when challanId is provided in URL
  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const cId = params ? params.get('challanId') : null;
    if (cId) {
      setSubView('invoices');
      const foundDc = challans.find((c) => c.challanId === cId);
      if (foundDc) {
        setInvModalData({ order: null, challan: foundDc });
      } else if (cId) {
        apiFetch(apiUrl(`/api/orders/delivery-challans/${encodeURIComponent(cId)}`), { headers: authHeaders(user) })
          .then((r) => r.json())
          .then((d) => {
            if (d && d.success && d.data) {
              setInvModalData({ order: null, challan: d.data });
            } else {
              setInvModalData({ order: null, challan: { challanId: cId } });
            }
          })
          .catch(() => setInvModalData({ order: null, challan: { challanId: cId } }));
      }
    }
  }, [challans]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, challansRes, invoicesRes, proformasRes, customersRes] = await Promise.all([
        apiFetch(apiUrl('/api/orders'), { headers: authHeaders(user) }),
        apiFetch(apiUrl('/api/orders/delivery-challans'), { headers: authHeaders(user) }),
        apiFetch(apiUrl('/api/orders/invoices'), { headers: authHeaders(user) }),
        apiFetch(apiUrl('/api/orders/proformas'), { headers: authHeaders(user) }),
        apiFetch(apiUrl('/api/customers'), { headers: authHeaders(user) })
      ]);

      const [ordersData, challansData, invoicesData, proformasData, customersData] = await Promise.all([
        ordersRes.json(),
        challansRes.json(),
        invoicesRes.json(),
        proformasRes.json(),
        customersRes.json()
      ]);

      if (ordersRes.ok && ordersData.success) {
        setOrders(ordersData.data || []);
      }
      if (challansRes.ok && challansData.success) {
        setChallans(challansData.data || []);
      }
      if (invoicesRes.ok && invoicesData.success) {
        setInvoices(invoicesData.data || []);
      }
      if (proformasRes.ok && proformasData.success) {
        setProformas(proformasData.data || []);
      }
      if (customersRes.ok && customersData.success) {
        setCustomers(customersData.data || []);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching order records:', err);
      setError((prev) => (orders.length === 0 && invoices.length === 0 && proformas.length === 0 ? 'Unable to load orders, proformas, and sales records from backend.' : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const handleCustomerCreated = (e) => {
      const newCust = e.detail?.customer;
      if (newCust && newCust.id) {
        setCustomers((prev) => [newCust, ...prev.filter((c) => c.id !== newCust.id)]);
      }
    };

    window.addEventListener('crm-customer-created', handleCustomerCreated);
    return () => {
      window.removeEventListener('crm-customer-created', handleCustomerCreated);
    };
  }, [user]);

  const handleTabChange = (tab) => {
    setSubView(tab);
    if (tab === 'invoices') {
      navigate('/orders/invoices');
      setInvoiceTabFilter('UNBILLED');
    } else if (tab === 'proformas') {
      navigate('/orders/proformas');
    } else {
      navigate('/orders');
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalPaidInvoices = invoices.filter((i) => i.paymentStatus === 'PAID').length;
  const totalPendingInvoices = invoices.filter((i) => i.paymentStatus !== 'PAID').length;

  // Filtered lists based on search - Natural ascending sequence order (1 above 2)
  const filteredOrders = useMemo(() => {
    const list = filterRecordsBySearch(orders, search, ORDER_SEARCH_EXTRACTORS);
    return list.sort((a, b) => {
      const aVal = String(a.orderId || '');
      const bVal = String(b.orderId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [orders, search]);

  const filteredChallans = useMemo(() => {
    const list = filterRecordsBySearch(challans, search, [
      (c) => c.challanId,
      (c) => c.orderId,
      (c) => c.customerName,
      (c) => c.customerCompany,
      (c) => c.company,
      (c) => c.receiverName,
      (c) => c.contactPerson,
      (c) => c.phone,
      (c) => c.mobile,
      (c) => c.status,
      (c) => c.deliveryType,
      (c) => c.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
    ]);
    return list.sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [challans, search]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (invoiceTabFilter === 'PENDING') {
      list = list.filter((i) => i.paymentStatus !== 'PAID');
    } else if (invoiceTabFilter === 'PAID') {
      list = list.filter((i) => i.paymentStatus === 'PAID');
    }
    const searched = filterRecordsBySearch(list, search, INVOICE_SEARCH_EXTRACTORS);
    return searched.sort((a, b) => {
      const aVal = String(a.invoiceId || '');
      const bVal = String(b.invoiceId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [invoices, invoiceTabFilter, search]);

  const filteredProformas = useMemo(() => {
    let list = proformas;
    if (proformaStatusFilter && proformaStatusFilter !== 'ALL') {
      list = list.filter((p) => (p.status || '').toUpperCase() === proformaStatusFilter.toUpperCase());
    }
    const searched = filterRecordsBySearch(list, search, PROFORMA_SEARCH_EXTRACTORS);
    return searched.sort((a, b) => {
      const aVal = String(a.proformaId || '');
      const bVal = String(b.proformaId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [proformas, proformaStatusFilter, search]);

  const unbilledChallans = useMemo(() => {
    return challans.filter((dc) => {
      const isReturnable = dc.deliveryPurpose === 'RETURNABLE' || dc.documentType === 'RETURNABLE_DC' || dc.isReturnableDC;
      if (isReturnable) return false;
      const hasInvoice = Boolean(
        dc.invoiceId ||
        invoices.some((inv) => inv.challanId && inv.challanId === dc.challanId)
      );
      return !hasInvoice;
    });
  }, [challans, invoices]);

  const filteredUnbilledChallans = useMemo(() => {
    const list = filterRecordsBySearch(unbilledChallans, search, [
      (c) => c.challanId,
      (c) => c.orderId,
      (c) => c.customerName,
      (c) => c.customerCompany,
      (c) => c.company,
      (c) => c.receiverName,
      (c) => c.refNo,
      (c) => c.status,
      (c) => c.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
    ]);
    return list.sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [unbilledChallans, search]);

  const totalUnbilledUnits = useMemo(() => {
    return unbilledChallans.reduce((sum, dc) => {
      const units = Array.isArray(dc.items)
        ? dc.items.reduce((s, it) => s + Number(it.quantity || 1), 0)
        : Number(dc.currentDeliveryQty || 1);
      return sum + units;
    }, 0);
  }, [unbilledChallans]);

  const totalEstimatedUnbilledValue = useMemo(() => {
    return unbilledChallans.reduce((sum, dc) => {
      const matchingOrder = orders.find((o) => o.orderId === dc.orderId);
      if (matchingOrder && matchingOrder.amount) {
        return sum + Number(matchingOrder.amount || 0);
      }
      const itemSum = (dc.items || []).reduce((s, it) => {
        const rate = Number(it.unitPrice || it.rate || it.price || 0);
        return s + (rate * Number(it.quantity || 1));
      }, 0);
      return sum + itemSum;
    }, 0);
  }, [unbilledChallans, orders]);

  // Dynamic table pagination with 44px standard row height
  const ordersPagination = useTablePagination(filteredOrders, {
    rowHeight: 44,
    resetDeps: [search]
  });

  const invoicesPagination = useTablePagination(filteredInvoices, {
    rowHeight: 44,
    resetDeps: [search, invoiceTabFilter]
  });

  const unbilledPagination = useTablePagination(filteredUnbilledChallans, {
    rowHeight: 44,
    resetDeps: [search]
  });

  const proformasPagination = useTablePagination(filteredProformas, {
    rowHeight: 44,
    resetDeps: [search, proformaStatusFilter]
  });

  const ordersFillerCount = Math.max(0, ordersPagination.pageSize - ordersPagination.currentRecords.length);
  const invoicesFillerCount = Math.max(0, invoicesPagination.pageSize - invoicesPagination.currentRecords.length);
  const unbilledFillerCount = Math.max(0, unbilledPagination.pageSize - unbilledPagination.currentRecords.length);
  const proformasFillerCount = Math.max(0, proformasPagination.pageSize - proformasPagination.currentRecords.length);

  // Proforma Conversion Handlers
  const handleConvertProformaToOrder = async (p) => {
    if (!window.confirm(`Convert Proforma ${p.proformaId} to a formal Sales Order?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/api/orders/proformas/${encodeURIComponent(p.proformaId || p.id)}/convert-to-order`), {
        method: 'POST',
        headers: authHeaders(user)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Converted to Sales Order successfully.');
        setTimeout(() => setSuccess(''), 4000);
        await fetchAll();
        setSubView('orders');
        navigate('/orders');
      } else {
        setError(data.message || 'Failed to convert to Sales Order.');
      }
    } catch (err) {
      setError('Unable to convert proforma to order.');
    }
  };

  const handleConvertProformaToInvoice = async (p) => {
    if (!window.confirm(`Convert Proforma ${p.proformaId} to a Sales Invoice?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/api/orders/proformas/${encodeURIComponent(p.proformaId || p.id)}/convert-to-invoice`), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({ status: 'ISSUED' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Converted to Sales Invoice successfully.');
        setTimeout(() => setSuccess(''), 4000);
        await fetchAll();
        setSubView('invoices');
        navigate('/orders/invoices');
      } else {
        setError(data.message || 'Failed to convert to Sales Invoice.');
      }
    } catch (err) {
      setError('Unable to convert proforma to invoice.');
    }
  };

  const handleUpdateProformaStatus = async (p, targetStatus) => {
    try {
      const res = await apiFetch(apiUrl(`/api/orders/proformas/${encodeURIComponent(p.proformaId || p.id)}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || `Proforma status updated to ${targetStatus}.`);
        setTimeout(() => setSuccess(''), 3000);
        await fetchAll();
      } else {
        setError(data.message || 'Failed to update proforma status.');
      }
    } catch (err) {
      setError('Unable to update proforma status.');
    }
  };

  // Payment status update handler
  const handleTogglePaymentStatus = async (invoice) => {
    const nextStatus = invoice.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      const res = await apiFetch(apiUrl(`/api/orders/invoices/${invoice.invoiceId}/payment`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({
          paymentStatus: nextStatus,
          paymentDate: nextStatus === 'PAID' ? new Date().toISOString() : null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Invoice ${invoice.invoiceId} marked as ${nextStatus}.`);
        setTimeout(() => setSuccess(''), 3000);
        if (viewDocData && viewDocData.data?.invoiceId === invoice.invoiceId) {
          setViewDocData((prev) => ({
            ...prev,
            data: { ...prev.data, paymentStatus: nextStatus }
          }));
        }
        fetchAll();
      } else {
        setError(data.message || 'Failed to update payment status.');
      }
    } catch (e) {
      setError('Unable to update payment status.');
    }
  };

  const totalProformaValue = proformas.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
  const activeProformasCount = proformas.filter((p) => p.status === 'SENT' || p.status === 'ACCEPTED').length;

  return (
    <div className="crm-orders-page-container">
      {/* KPI Cards */}
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Closed Orders</span>
            <span className="kpi-value">{orders.length}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Proforma ({activeProformasCount} Active)</span>
            <span className="kpi-value">₹{totalProformaValue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="kpi-content">
            <span
              className="kpi-label"
              style={{ cursor: 'pointer' }}
              onClick={() => { setSubView('invoices'); setInvoiceTabFilter('PAID'); }}
              title="Click to view Paid Invoices"
            >
              Invoices ({totalPaidInvoices} Paid)
            </span>
            <span className="kpi-value">₹{totalInvoiced.toLocaleString('en-IN')}</span>
            {unbilledChallans.length > 0 && (
              <span
                className="kpi-unbilled-alert"
                onClick={() => { setSubView('invoices'); setInvoiceTabFilter('UNBILLED'); }}
                title="Click to view Delivery Challans not yet converted to an invoice"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#b45309',
                  background: '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: '1px solid #fde68a'
                }}
              >
                ⚠️ {unbilledChallans.length} Unbilled DCs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subviews Tab Bar */}
      <div className="orders-tab-nav-bar">
        <button
          type="button"
          className={`orders-tab-btn ${subView === 'orders' ? 'active' : ''}`}
          onClick={() => handleTabChange('orders')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span>Orders</span>
          <span className="tab-badge">{orders.length}</span>
        </button>

        <button
          type="button"
          className={`orders-tab-btn ${subView === 'proformas' ? 'active' : ''}`}
          onClick={() => handleTabChange('proformas')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Proforma</span>
          <span className="tab-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>{proformas.length}</span>
        </button>

        <button
          type="button"
          className={`orders-tab-btn ${subView === 'invoices' ? 'active' : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Invoices</span>
          <span className="tab-badge">{invoices.length}</span>
          {unbilledChallans.length > 0 && (
            <span
              className="tab-badge unbilled-badge"
              style={{
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                marginLeft: '4px',
                fontWeight: 700
              }}
              title={`${unbilledChallans.length} Delivery Challans dispatched without an invoice`}
            >
              ⚠️ {unbilledChallans.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Bar */}
      <div className="table-controls-card">
        <div className="search-form-wrap full-width">
          <div className="search-input-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={
                subView === 'proformas'
                  ? 'Search Proformas...'
                  : subView === 'invoices'
                    ? 'Search Invoices...'
                    : 'Search Orders...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-field"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
              >
                ✕
              </button>
            )}
          </div>
          <button type="button" className="crm-btn-secondary compact" onClick={fetchAll} disabled={loading}>
            Refresh
          </button>
          {subView === 'proformas' && canCreate && (
            <button
              type="button"
              className="crm-btn-primary compact add-new-inv-btn"
              onClick={() => setProformaModalData({ proforma: null, isRevision: false })}
              title="Create new Proforma"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#4338ca' }}
            >
              <span>+ Create Proforma</span>
            </button>
          )}
          {subView === 'invoices' && canCreate && (
            <button
              type="button"
              className="crm-btn-primary compact add-new-inv-btn"
              onClick={() => setInvModalData({ order: null, challan: null })}
              title="Create new Invoice"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ Create Invoice</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="crm-alert-box error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="close-toast-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#991b1b' }}>✕</button>
        </div>
      )}
      {success && (
        <div className="crm-alert-box success">
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: SALES ORDERS */}
      {subView === 'orders' && (
        <section className="crm-table-workspace stocks-content-card stocks-master-page orders-master-page">
          {loading ? (
            <div className="crm-loading-full">
              <div className="crm-spinner" />
              <p>Loading orders...</p>
            </div>
          ) : (
            <div className="settings-table-shell orders-table-shell">
              <div className="crm-table-viewport crm-table-scroll-wrap">
                <table className="crm-master-table crm-data-table settings-table orders-settings-table orders-data-table">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="order-col-customer" style={{ textAlign: 'left' }}>Customer</th>
                    <th className="order-col-enquiry" style={{ textAlign: 'center' }}>ENQ No</th>
                    <th className="order-col-quote" style={{ textAlign: 'center' }}>QUOT No</th>
                    <th className="order-col-amount" style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th className="order-col-items" style={{ textAlign: 'center' }}>Items</th>
                    <th className="order-col-status" style={{ textAlign: 'center' }}>Status</th>
                    <th className="order-col-actions" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="7">
                        <div className="table-empty-state">
                          <p>{search.trim() ? `No orders found matching "${search.trim()}".` : 'No orders found. Orders are created explicitly from accepted quotations.'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {ordersPagination.currentRecords.map((o) => {
                        const linkedDcs = challans.filter((c) => c.orderId === o.orderId);
                        const linkedInvs = invoices.filter((i) => i.orderId === o.orderId);
                        const hasDc = linkedDcs.length > 0;
                        const hasInv = linkedInvs.length > 0;
                        const isCompleted = !o.status || o.status.toUpperCase() === 'COMPLETED' || o.status.toUpperCase() === 'CLOSED';
                        const orderItemsList = parseOrderItems(o.items);
                        const isExpanded = expandedOrderId === o.orderId;

                        return (
                          <tr key={o.orderId} className={`table-data-row ${isExpanded ? 'row-items-expanded' : ''}`}>
                            <td className="order-col-customer" data-label="Customer" style={{ textAlign: 'left' }}>
                              <a
                                className="order-customer-name"
                                href={`/customers/${encodeURIComponent(o.customerId)}`}
                                onClick={(e) => {
                                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                    e.preventDefault();
                                    onNavigateCustomer && onNavigateCustomer(o.customerId);
                                  }
                                }}
                                title={`Customer: ${o.customerName}`}
                              >
                                {o.customerName}
                              </a>
                            </td>
                            <td className="order-col-enquiry" data-label="ENQ No" style={{ textAlign: 'center' }}>
                              {o.enquiryId ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectEnquiry && onSelectEnquiry(o.enquiryId, 'solved')}
                                  className="enquiry-id-link"
                                  title={`View Origin Enquiry: ${o.enquiryId}`}
                                >
                                  {o.enquiryId}
                                </button>
                              ) : (
                                <span className="direct-order-label">Direct</span>
                              )}
                            </td>
                            <td className="order-col-quote" data-label="QUOT No" style={{ textAlign: 'center' }}>
                              {o.quotationId ? (
                                <span className="quote-id-tag" title={`Quotation: ${o.quotationId}`}>{o.quotationId}</span>
                              ) : (
                                <span className="direct-order-label">—</span>
                              )}
                            </td>
                            <td className="order-col-amount" data-label="Amount (₹)" style={{ textAlign: 'right' }}>
                              <span className="order-amount-text">₹{Number(o.amount).toLocaleString('en-IN')}</span>
                            </td>
                            <td className="order-col-items" data-label="Items" style={{ textAlign: 'center' }}>
                              <div className="order-items-cell-wrap">
                                {orderItemsList.length === 0 ? (
                                  <span className="order-items-empty">—</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className={`order-items-toggle-btn ${isExpanded ? 'active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedOrderId((prev) => (prev === o.orderId ? null : o.orderId));
                                      }}
                                      aria-expanded={isExpanded}
                                      title={isExpanded ? 'Collapse items' : 'View items'}
                                    >
                                      <span>{orderItemsList.length} {orderItemsList.length === 1 ? 'Item' : 'Items'}</span>
                                      <span className="order-items-toggle-arrow" aria-hidden="true">
                                        {isExpanded ? '▲' : '▼'}
                                      </span>
                                    </button>

                                    {isExpanded && (
                                      <div className="order-items-dropdown-list">
                                        {orderItemsList.map((itemStr, idx) => (
                                          <div key={idx} className="order-expanded-item-row" title={itemStr}>
                                            {itemStr}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="order-col-status" data-label="Status" style={{ textAlign: 'center' }}>
                              <span className={`order-status-badge ${isCompleted ? 'completed' : 'other'}`}>
                                {isCompleted ? 'COMPLETED' : o.status}
                              </span>
                            </td>
                            <td className="order-col-actions" data-label="Actions" style={{ textAlign: 'right' }}>
                              <div className="order-actions-group">
                                <button
                                  type="button"
                                  onClick={() => onSelectEnquiry && onSelectEnquiry(o.enquiryId, 'solved')}
                                  className="order-btn order-btn-case"
                                  title="View case details and history"
                                >
                                  Case
                                </button>

                                {hasInv ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewDocData({ type: 'INV', data: linkedInvs[0] })}
                                    className="order-btn order-btn-inv"
                                    title={`View Sales Invoice (${linkedInvs[0].invoiceId})`}
                                  >
                                    INV
                                  </button>
                                ) : canCreate ? (
                                  <button
                                    type="button"
                                    onClick={() => setInvModalData({ order: o, challan: linkedDcs[0] || null })}
                                    className="order-btn order-btn-inv-create"
                                    title="Create Sales Invoice"
                                  >
                                    + INV
                                  </button>
                                ) : null}

                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => setProformaModalData({ proforma: null, upstreamOrder: o })}
                                    className="order-btn"
                                    style={{ background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 600 }}
                                    title="Create Proforma Invoice from this Order"
                                  >
                                    + PI
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {ordersFillerCount > 0 && Array.from({ length: ordersFillerCount }).map((_, fIdx) => (
                        <tr key={`filler-ord-${fIdx}`} className="table-filler-row" aria-hidden="true">
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              </div>
              <TableFooter
                showingStart={ordersPagination.showingStart}
                showingEnd={ordersPagination.showingEnd}
                total={ordersPagination.totalRecords}
                recordLabel="orders"
                singularLabel="order"
                currentPage={ordersPagination.currentPage}
                totalPages={ordersPagination.totalPages}
                onPageChange={ordersPagination.goToPage}
              />
            </div>
          )}
        </section>
      )}

      {/* TAB 2: SALES INVOICES (INV) */}
      
      {subView === 'invoices' && (
        <section className="crm-table-workspace stocks-content-card stocks-master-page orders-master-page invoices-master-page">
          {/* Invoicing Section Subnav Switcher & Revenue Alert */}
          <div className="invoices-subnav-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
            <div className="invoices-view-pills" style={{ display: 'inline-flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '3px', flexWrap: 'wrap' }}>
              {/* 1. First: Pending Invoicing DCs */}
              <button
                type="button"
                className={`invoices-view-pill-btn ${invoiceTabFilter === 'UNBILLED' ? 'active' : ''}`}
                onClick={() => setInvoiceTabFilter('UNBILLED')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: invoiceTabFilter === 'UNBILLED' ? 700 : 500,
                  background: invoiceTabFilter === 'UNBILLED' ? '#ffffff' : 'transparent',
                  color: invoiceTabFilter === 'UNBILLED' ? '#b45309' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: invoiceTabFilter === 'UNBILLED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ color: '#d97706' }}>⚠️</span>
                <span>Pending Invoicing DCs</span>
                <span style={{
                  fontSize: '11px',
                  background: unbilledChallans.length > 0 ? '#fef3c7' : '#e2e8f0',
                  color: unbilledChallans.length > 0 ? '#92400e' : '#64748b',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  border: unbilledChallans.length > 0 ? '1px solid #fde68a' : 'none'
                }}>
                  {unbilledChallans.length}
                </span>
              </button>

              {/* 2. Next: Pending Invoices */}
              <button
                type="button"
                className={`invoices-view-pill-btn ${invoiceTabFilter === 'PENDING' ? 'active' : ''}`}
                onClick={() => setInvoiceTabFilter('PENDING')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: invoiceTabFilter === 'PENDING' ? 700 : 500,
                  background: invoiceTabFilter === 'PENDING' ? '#ffffff' : 'transparent',
                  color: invoiceTabFilter === 'PENDING' ? '#b45309' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: invoiceTabFilter === 'PENDING' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⏳</span>
                <span>Pending Invoices</span>
                <span style={{
                  fontSize: '11px',
                  background: totalPendingInvoices > 0 ? '#fef3c7' : '#e2e8f0',
                  color: totalPendingInvoices > 0 ? '#92400e' : '#64748b',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  border: totalPendingInvoices > 0 ? '1px solid #fde68a' : 'none'
                }}>
                  {totalPendingInvoices}
                </span>
              </button>

              {/* 3. Next: Paid Invoices */}
              <button
                type="button"
                className={`invoices-view-pill-btn ${invoiceTabFilter === 'PAID' ? 'active' : ''}`}
                onClick={() => setInvoiceTabFilter('PAID')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: invoiceTabFilter === 'PAID' ? 700 : 500,
                  background: invoiceTabFilter === 'PAID' ? '#ffffff' : 'transparent',
                  color: invoiceTabFilter === 'PAID' ? '#15803d' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: invoiceTabFilter === 'PAID' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ color: '#16a34a' }}>✓</span>
                <span>Paid Invoices</span>
                <span style={{
                  fontSize: '11px',
                  background: totalPaidInvoices > 0 ? '#dcfce7' : '#e2e8f0',
                  color: totalPaidInvoices > 0 ? '#166534' : '#64748b',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  border: totalPaidInvoices > 0 ? '1px solid #bbf7d0' : 'none'
                }}>
                  {totalPaidInvoices}
                </span>
              </button>

              {/* 4. All Invoices */}
              <button
                type="button"
                className={`invoices-view-pill-btn ${invoiceTabFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setInvoiceTabFilter('ALL')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: invoiceTabFilter === 'ALL' ? 700 : 500,
                  background: invoiceTabFilter === 'ALL' ? '#ffffff' : 'transparent',
                  color: invoiceTabFilter === 'ALL' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: invoiceTabFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>All Invoices</span>
                <span style={{
                  fontSize: '11px',
                  background: invoiceTabFilter === 'ALL' ? '#e2e8f0' : '#cbd5e1',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {invoices.length}
                </span>
              </button>
            </div>

            {unbilledChallans.length > 0 && invoiceTabFilter !== 'UNBILLED' && (
              <button
                type="button"
                onClick={() => setInvoiceTabFilter('UNBILLED')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="View delivery challans that do not have an invoice"
              >
                <span>⚠️ Revenue Alert: {unbilledChallans.length} Delivery Challan(s) ({totalUnbilledUnits} units) have not been invoiced!</span>
                <span style={{ textDecoration: 'underline' }}>Review Unbilled DCs →</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="crm-loading-full">
              <div className="crm-spinner" />
              <p>Loading Invoices...</p>
            </div>
          ) : invoiceTabFilter === 'UNBILLED' ? (
            /* UNBILLED DELIVERY CHALLANS REGISTER TABLE */
            <div className="settings-table-shell unbilled-dc-table-shell">
              <div className="unbilled-dc-banner" style={{ padding: '10px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#92400e', fontSize: '13px' }}>
                      Delivery Challans Not Converted to Invoice ({filteredUnbilledChallans.length})
                    </strong>
                    <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                      Goods have been dispatched/delivered without an invoice. Convert them to invoice to prevent financial loss and reconcile accounting.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#78350f', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Unbilled Units</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>{totalUnbilledUnits} units</span>
                  </div>
                </div>
              </div>

              <div className="crm-table-viewport crm-table-scroll-wrap">
                <table className="crm-master-table crm-data-table settings-table unbilled-dc-settings-table">
                  <colgroup>
                    <col style={{ width: '3.5%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '5.5%' }} />
                    <col style={{ width: '7.5%' }} />
                    <col style={{ width: '19.5%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: '3.5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '10%', textAlign: 'left' }}>CHALLAN ID</th>
                      <th style={{ width: '9%', textAlign: 'center' }}>DC DATE</th>
                      <th style={{ width: '17%', textAlign: 'left' }}>CUSTOMER / COMPANY</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>SALES ORDER / REF</th>
                      <th style={{ width: '16%', textAlign: 'left' }}>ITEMS DISPATCHED</th>
                      <th style={{ width: '5.5%', textAlign: 'center' }}>UNITS</th>
                      <th style={{ width: '7.5%', textAlign: 'center' }}>STATUS</th>
                      <th style={{ width: '19.5%', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnbilledChallans.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="9">
                          <div className="table-empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</div>
                            <h4 style={{ margin: '0 0 6px', color: '#166534', fontWeight: 600 }}>All Dispatched Delivery Challans Are Invoiced</h4>
                            <p style={{ margin: 0, color: '#4b5563', fontSize: '13px' }}>
                              {search.trim() ? `No unbilled Delivery Challans found matching "${search.trim()}".` : 'There are no pending unconverted Delivery Challans. All shipments have been billed successfully.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {unbilledPagination.currentRecords.map((dc, idx) => {
                          const rowIndex = (unbilledPagination.currentPage - 1) * unbilledPagination.pageSize + idx + 1;
                          const items = dc.items || [];
                          const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Dispatched Items';
                          const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
                          const totalUnits = items.reduce((s, it) => s + Number(it.quantity || 1), 0);

                          return (
                            <tr key={dc.challanId || idx} className="table-data-row">
                              <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                                {rowIndex}
                              </td>
                              <td className="cell-nowrap">
                                <strong className="order-id-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                                  {dc.challanId}
                                </strong>
                              </td>
                              <td className="cell-nowrap" style={{ textAlign: 'center' }}>
                                {formatTableDate(dc.deliveryDate || dc.createdAt)}
                              </td>
                              <td className="cell-wrap">
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {dc.customerName || '—'}
                                </div>
                                {dc.company && dc.company !== dc.customerName && (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                    {dc.company}
                                  </div>
                                )}
                              </td>
                              <td className="cell-nowrap" style={{ textAlign: 'center' }}>
                                {dc.orderId ? (
                                  <strong className="order-id-badge" style={{ minWidth: '85px', display: 'inline-block' }}>{dc.orderId}</strong>
                                ) : dc.refNo ? (
                                  <span style={{ fontSize: '11.5px', color: '#475569' }}>Ref: {dc.refNo}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                                )}
                              </td>
                              <td className="cell-wrap">
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>{summaryText}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                  {items.length} line item(s)
                                </div>
                              </td>
                              <td className="cell-nowrap" style={{ textAlign: 'center' }}>
                                <span className="dc-items-count-badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                  {totalUnits}
                                </span>
                              </td>
                              <td className="cell-nowrap" style={{ textAlign: 'center' }}>
                                <span
                                  className="status-badge"
                                  style={{
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '999px'
                                  }}
                                  title="Dispatched but no sales invoice created yet"
                                >
                                  ⚠️ Unbilled
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="table-action-btn-group unbilled-dc-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setInvModalData({ order: null, challan: dc })}
                                    className="tbl-action-btn primary btn-unbilled-generate-invoice"
                                    title="Create Sales Invoice against this Delivery Challan"
                                  >
                                    <Plus size={13} strokeWidth={2.5} />
                                    <span>Generate Invoice</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setViewDocData({ type: 'DC', data: dc })}
                                    className="tbl-action-btn btn-unbilled-view"
                                    title="View Delivery Challan"
                                  >
                                    <Eye size={13} strokeWidth={2} />
                                    <span>View</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {unbilledFillerCount > 0 && Array.from({ length: unbilledFillerCount }).map((_, fIdx) => (
                          <tr key={`filler-unbilled-${fIdx}`} className="table-filler-row" aria-hidden="true">
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'left' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'left' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'left' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={unbilledPagination.showingStart}
                showingEnd={unbilledPagination.showingEnd}
                total={unbilledPagination.totalRecords}
                recordLabel="unbilled delivery challans"
                singularLabel="unbilled delivery challan"
                currentPage={unbilledPagination.currentPage}
                totalPages={unbilledPagination.totalPages}
                onPageChange={unbilledPagination.goToPage}
              />
            </div>
          ) : (
            <div className="settings-table-shell invoices-table-shell">
              {invoiceTabFilter === 'PENDING' && (
                <div style={{ padding: '10px 16px', background: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⏳</span>
                    <strong style={{ color: '#92400e', fontSize: '13px' }}>
                      Pending Invoices ({filteredInvoices.length})
                    </strong>
                    <span style={{ fontSize: '12px', color: '#b45309' }}>
                      — Invoices awaiting customer payment collection. Click status to mark as Paid.
                    </span>
                  </div>
                </div>
              )}
              {invoiceTabFilter === 'PAID' && (
                <div style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#16a34a' }}>✓</span>
                    <strong style={{ color: '#166534', fontSize: '13px' }}>
                      Paid Invoices ({filteredInvoices.length})
                    </strong>
                    <span style={{ fontSize: '12px', color: '#15803d' }}>
                      — Confirmed paid invoices with reconciled payments.
                    </span>
                  </div>
                </div>
              )}
              <div className="crm-table-viewport crm-table-scroll-wrap">
                <table className="crm-master-table crm-data-table settings-table invoices-settings-table invoices-data-table">
                <colgroup>
                  <col style={{ width: '13.5%' }} />
                  <col style={{ width: '15.5%' }} />
                  <col style={{ width: '13.5%' }} />
                  <col style={{ width: '17.5%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-priority-high" style={{ textAlign: 'left' }}>INVOICE ID</th>
                    <th className="col-priority-med" style={{ textAlign: 'center' }}>SALES ORDER</th>
                    <th className="col-priority-med" style={{ textAlign: 'center' }}>DELIVERY REF</th>
                    <th className="col-priority-high" style={{ textAlign: 'left' }}>CUSTOMER / COMPANY</th>
                    <th className="col-priority-med" style={{ textAlign: 'center' }}>INV DATE</th>
                    <th className="col-priority-med" style={{ textAlign: 'right' }}>SUBTOTAL</th>
                    <th className="col-priority-med" style={{ textAlign: 'right' }}>GST</th>
                    <th className="col-priority-high" style={{ textAlign: 'right' }}>GRAND TOTAL</th>
                    <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                    <th className="col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="10">
                        <div className="table-empty-state">
                          <p>
                            {search.trim()
                              ? `No invoices found matching "${search.trim()}".`
                              : invoiceTabFilter === 'PENDING'
                                ? 'No pending unpaid invoices. All generated invoices have been paid!'
                                : invoiceTabFilter === 'PAID'
                                  ? 'No paid invoices found yet. Mark invoices as paid once customer payment is received.'
                                  : 'No Invoices generated yet. Create an Invoice from any Order or Delivery Challan.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {invoicesPagination.currentRecords.map((inv) => (
                      <tr key={inv.invoiceId} className="table-data-row">
                        <td className="col-priority-high cell-nowrap" data-label="INVOICE ID">
                          <strong className="order-id-badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }} title={inv.invoiceId}>
                            {inv.invoiceId}
                          </strong>
                        </td>
                        <td className="col-priority-med cell-nowrap" style={{ textAlign: 'center' }} data-label="SALES ORDER">
                          <strong className="order-id-badge" style={{ maxWidth: '100%', display: 'inline-block' }} title={inv.orderId || '—'}>
                            {inv.orderId || '—'}
                          </strong>
                        </td>
                        <td className="col-priority-med cell-nowrap" style={{ textAlign: 'center' }} data-label="DELIVERY REF">
                          {inv.challanId ? (
                            <strong className="order-id-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', maxWidth: '100%', display: 'inline-block' }} title={inv.challanId}>
                              {inv.challanId}
                            </strong>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        <td className="col-priority-high cell-wrap" data-label="CUSTOMER / COMPANY">
                          <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={inv.customerName}>
                            {inv.customerName || '—'}
                          </div>
                          {inv.company && inv.company !== inv.customerName && (
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }} title={inv.company}>
                              {inv.company}
                            </div>
                          )}
                        </td>
                        <td className="col-priority-med cell-nowrap" style={{ textAlign: 'center' }} data-label="INV DATE">{inv.invoiceDate || '—'}</td>
                        <td className="col-priority-med cell-nowrap" style={{ textAlign: 'right', fontFamily: 'monospace' }} data-label="SUBTOTAL">
                          ₹{Number(inv.subtotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="col-priority-med cell-nowrap" style={{ textAlign: 'right', fontFamily: 'monospace' }} data-label="GST">
                          ₹{Number(inv.gstTotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="col-priority-high cell-nowrap" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }} data-label="GRAND TOTAL">
                          ₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="col-priority-high cell-nowrap" style={{ textAlign: 'center' }} data-label="STATUS">
                          <button
                            type="button"
                            className={`status-badge-interactive ${inv.paymentStatus === 'PAID' ? 'paid' : 'pending'}`}
                            onClick={() => canEdit && handleTogglePaymentStatus(inv)}
                            title={canEdit ? 'Click to toggle Paid / Pending' : ''}
                          >
                            {inv.paymentStatus === 'PAID' ? '✓ PAID' : 'PENDING'}
                          </button>
                        </td>
                        <td className="col-priority-high" style={{ textAlign: 'right' }} data-label="ACTIONS">
                          <div className="table-action-btn-group" style={{ justifyContent: 'flex-end', position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setViewDocData({ type: 'INV', data: inv });
                                navigate(`/orders/invoices/${inv.invoiceId}`);
                              }}
                              className="tbl-action-btn"
                              title="View / Print Sales Invoice"
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} strokeWidth={2} />
                              <span>View</span>
                            </button>
                            <div className="invoice-download-btn-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveInvoiceDownloadMenuId((prev) => (prev === inv.invoiceId ? null : inv.invoiceId));
                                }}
                                className="tbl-action-btn"
                                title="Download PDF Options"
                                disabled={downloadingInvoiceState?.id === inv.invoiceId}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                {downloadingInvoiceState?.id === inv.invoiceId ? (
                                  <span className="crm-loading-spinner inline-spinner" style={{ width: '10px', height: '10px' }} />
                                ) : (
                                  <>
                                    <span>Download</span>
                                    <span style={{ fontSize: '9px' }}>▼</span>
                                  </>
                                )}
                              </button>

                              {activeInvoiceDownloadMenuId === inv.invoiceId && (
                                <div
                                  className="invoice-download-menu"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 'calc(100% + 4px)',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                                    zIndex: 1050,
                                    minWidth: '220px',
                                    padding: '4px 0',
                                    textAlign: 'left'
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="invoice-download-menu-item"
                                    onClick={() => handleDownloadInvoicePdf(inv, false)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      fontSize: '12px',
                                      border: 'none',
                                      background: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      color: '#334155'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <span style={{ fontSize: '13px' }}>📄</span>
                                    <span>Download as PDF (Unsigned)</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="invoice-download-menu-item"
                                    onClick={() => handleDownloadInvoicePdf(inv, true)}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      fontSize: '12px',
                                      border: 'none',
                                      background: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      color: '#1e3a8a',
                                      fontWeight: 600
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <span style={{ fontSize: '13px' }}>✍️</span>
                                    <span>Download as PDF (Signed)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {invoicesFillerCount > 0 && Array.from({ length: invoicesFillerCount }).map((_, fIdx) => (
                      <tr key={`filler-inv-${fIdx}`} className="table-filler-row" aria-hidden="true">
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                      </tr>
                    ))}
                  </>
                )}
                </tbody>
              </table>
              </div>
              <TableFooter
                showingStart={invoicesPagination.showingStart}
                showingEnd={invoicesPagination.showingEnd}
                total={invoicesPagination.totalRecords}
                recordLabel={
                  invoiceTabFilter === 'PENDING' ? 'pending invoices' :
                  invoiceTabFilter === 'PAID' ? 'paid invoices' : 'invoices'
                }
                singularLabel={
                  invoiceTabFilter === 'PENDING' ? 'pending invoice' :
                  invoiceTabFilter === 'PAID' ? 'paid invoice' : 'invoice'
                }
                currentPage={invoicesPagination.currentPage}
                totalPages={invoicesPagination.totalPages}
                onPageChange={invoicesPagination.goToPage}
              />
            </div>
          )}
        </section>
      )}

      {/* TAB 2: PROFORMA INVOICES */}
      {subView === 'proformas' && (
        <section className="crm-table-workspace stocks-content-card stocks-master-page orders-master-page">
          {/* Status Filter Bar */}
          <div className="proforma-status-filter-pills" style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REVISED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONVERTED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`crm-filter-pill ${proformaStatusFilter === st ? 'active' : ''}`}
                onClick={() => setProformaStatusFilter(st)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: proformaStatusFilter === st ? '#4338ca' : '#cbd5e1',
                  background: proformaStatusFilter === st ? '#4338ca' : '#ffffff',
                  color: proformaStatusFilter === st ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {st === 'ALL' ? `ALL (${proformas.length})` : `${st} (${proformas.filter((p) => p.status === st).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="crm-loading-full">
              <div className="crm-spinner" />
              <p>Loading proforma invoices...</p>
            </div>
          ) : (
            <div className="settings-table-shell proforma-table-shell">
              <div className="crm-table-viewport crm-table-scroll-wrap proforma-table-scroll-wrap">
                <table className="crm-master-table crm-data-table settings-table proforma-management-table">
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-priority-high" style={{ textAlign: 'left' }}>Proforma No</th>
                      <th className="col-priority-med" style={{ textAlign: 'center' }}>Date</th>
                      <th className="col-priority-high" style={{ textAlign: 'left' }}>Customer</th>
                      <th className="col-priority-med" style={{ textAlign: 'center' }}>Items</th>
                      <th className="col-priority-high" style={{ textAlign: 'right' }}>Amount (₹)</th>
                      <th className="col-priority-high" style={{ textAlign: 'center' }}>Status</th>
                      <th className="col-priority-high" style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProformas.length === 0 ? (
                      <tr className="proforma-empty-row">
                        <td colSpan="7" className="proforma-empty-cell">
                          <div className="proforma-empty-state-wrapper">
                            <div className="proforma-empty-title">
                              {search.trim() ? `No proformas found matching "${search.trim()}".` : 'No proformas found for this status.'}
                            </div>
                            <div className="proforma-empty-subtitle">
                              {search.trim()
                                ? 'Try searching for a different keyword or clear the search.'
                                : proformaStatusFilter === 'ALL'
                                  ? 'Click "+ Create Proforma" to generate one.'
                                  : `There are currently no proformas with status "${proformaStatusFilter}".`}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {proformasPagination.currentRecords.map((p, pIdx) => {
                        const isExpired = p.status === 'EXPIRED' || (p.status === 'SENT' && p.validUntil && p.validUntil < new Date().toISOString().slice(0, 10));
                        const rowId = p.revisionId || p.proformaId || p.id;
                        const isExpanded = expandedProformaId === rowId;
                        const toggleExpand = (e) => {
                          e.stopPropagation();
                          setExpandedProformaId((prev) => (prev === rowId ? null : rowId));
                        };
                        const isPopoverOpen = openItemPopoverId === rowId;
                        const isNearBottom = pIdx >= filteredProformas.length - 2 && filteredProformas.length > 2;
                        const itemCount = Array.isArray(p.items) ? p.items.length : 0;
                        const canRevise = p.status !== 'CANCELLED' && p.status !== 'CONVERTED' && canEdit;
                        const canSend = p.status === 'DRAFT';
                        const canAcceptReject = p.status === 'SENT';
                        const canConvert = p.status === 'ACCEPTED' && (!p.convertedOrderId || !p.convertedInvoiceId);
                        const hasMoreActions = canRevise || canSend || canAcceptReject || canConvert;

                        return (
                          <React.Fragment key={rowId}>
                            <tr className={`crm-table-row ${isExpanded ? 'row-expanded' : ''} ${isPopoverOpen ? 'has-open-popover' : ''}`}>
                              {/* 1. PROFORMA NO: 14% (No chevron/expand button) */}
                              <td className="col-priority-high cell-nowrap" style={{ textAlign: 'left' }} data-label="Proforma No">
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="proforma-id-link"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewDocData({ type: 'PI', data: p });
                                      navigate(`/orders/proformas/${p.proformaId}`);
                                    }}
                                    title="View Proforma PDF"
                                  >
                                    {p.proformaId}
                                  </button>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #dbeafe',
                                      lineHeight: '1.2'
                                    }}
                                  >
                                    Rev {p.revisionNumber || 1}
                                  </span>
                                </div>
                              </td>

                              {/* 2. DATE: 13% (Only proforma date, no validUntil in summary) */}
                              <td className="col-priority-med cell-nowrap" style={{ textAlign: 'center' }} data-label="Date">
                                <span style={{ fontSize: '12px', fontWeight: 500, color: '#0f172a' }}>
                                  {formatTableDate(p.proformaDate)}
                                </span>
                              </td>

                              {/* 3. CUSTOMER: 25% (Compact, no vertical elongation) */}
                              <td className="col-priority-high cell-wrap" style={{ textAlign: 'left' }} data-label="Customer">
                                <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      fontSize: '12.5px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    title={p.customerName}
                                  >
                                    {p.customerName || '—'}
                                  </div>
                                  {p.company && p.company !== p.customerName && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: '#64748b',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        marginTop: '1px'
                                      }}
                                      title={p.company}
                                    >
                                      {p.company}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 4. ITEMS: 12% (Compact popover matching Quotations) */}
                              <td className="col-priority-med cell-nowrap quotation-items-cell proforma-items-cell" style={{ textAlign: 'center' }} data-label="Items">
                                {itemCount === 0 ? (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                ) : (
                                  <div className="quotation-items-wrapper">
                                    <button
                                      type="button"
                                      className={`quotation-items-trigger ${isPopoverOpen ? 'active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenItemPopoverId(isPopoverOpen ? null : rowId);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setOpenItemPopoverId(isPopoverOpen ? null : rowId);
                                        }
                                      }}
                                      aria-expanded={isPopoverOpen}
                                      aria-haspopup="true"
                                      title="Click to view proforma items"
                                    >
                                      <span>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
                                      <span className="quotation-items-arrow" aria-hidden="true">{isPopoverOpen ? '▴' : '▾'}</span>
                                    </button>

                                    {isPopoverOpen && (
                                      <div
                                        className={`quotation-items-popover ${isNearBottom ? 'placement-top' : ''}`}
                                        role="dialog"
                                        aria-label="Proforma items"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="quotation-items-popover-header">
                                          <span>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
                                          <button
                                            type="button"
                                            className="quotation-items-popover-close"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenItemPopoverId(null);
                                            }}
                                            aria-label="Close items list"
                                            title="Close"
                                          >
                                            ×
                                          </button>
                                        </div>
                                        <ul className="quotation-items-popover-list">
                                          {(p.items || []).map((it, idx) => {
                                            const qty = it.quantity || it.qty || 1;
                                            const name = it.productName || it.name || it.item || 'Product';
                                            const sku = it.productCode || it.sku || '';
                                            return (
                                              <li key={idx} className="quotation-items-popover-item" style={sku ? { flexDirection: 'column', alignItems: 'flex-start', gap: '1px' } : undefined}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', width: '100%' }}>
                                                  <span className="popover-item-qty">{qty} ×</span>{' '}
                                                  <span className="popover-item-name">{name}</span>
                                                </div>
                                                {sku && (
                                                  <div style={{ fontSize: '10px', color: '#64748b', paddingLeft: '22px', fontFamily: 'monospace' }}>
                                                    SKU: {sku}
                                                  </div>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 5. AMOUNT (₹): 12% (Right-aligned) */}
                              <td className="col-priority-high cell-nowrap" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '12.5px', fontFamily: 'monospace' }} data-label="Amount (₹)">
                                ₹ {Number(p.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* 6. STATUS: 9% (Center-aligned compact badge) */}
                              <td className="col-priority-high cell-nowrap" style={{ textAlign: 'center' }} data-label="Status">
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    ...getStatusStyle(p.status)
                                  }}
                                >
                                  {p.status || 'DRAFT'}
                                </span>
                              </td>

                              {/* 7. ACTIONS: 15% (Compact horizontal buttons + More dropdown) */}
                              <td className="col-priority-high cell-nowrap" style={{ textAlign: 'right', position: 'relative' }} data-label="Actions">
                                <div className="proforma-actions-group">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewDocData({ type: 'PI', data: p });
                                      navigate(`/orders/proformas/${p.proformaId}`);
                                    }}
                                    className="proforma-table-action-btn"
                                    title="View / Print PDF"
                                  >
                                    👁 View
                                  </button>

                                  {p.status === 'DRAFT' && canEdit && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProformaModalData({ proforma: p, isRevision: false });
                                      }}
                                      className="proforma-table-action-btn edit"
                                      title="Edit Draft"
                                    >
                                      ✏ Edit
                                    </button>
                                  )}

                                  {hasMoreActions && (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMoreMenuId(activeMoreMenuId === rowId ? null : rowId);
                                        }}
                                        className={`proforma-table-action-btn more ${activeMoreMenuId === rowId ? 'is-active' : ''}`}
                                        title="More actions"
                                      >
                                        <span>More</span>
                                        <span style={{ fontSize: '9px', marginLeft: '2px' }}>▾</span>
                                      </button>

                                      {activeMoreMenuId === rowId && (
                                        <div
                                          className="proforma-more-dropdown-menu"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {canRevise && (
                                            <button
                                              type="button"
                                              className="proforma-more-menu-item"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMoreMenuId(null);
                                                setProformaModalData({ proforma: p, isRevision: true });
                                              }}
                                            >
                                              <span style={{ width: '16px' }}>🔄</span> Revise
                                            </button>
                                          )}

                                          {canSend && (
                                            <button
                                              type="button"
                                              className="proforma-more-menu-item"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMoreMenuId(null);
                                                handleUpdateProformaStatus(p, 'SENT');
                                              }}
                                            >
                                              <span style={{ width: '16px' }}>📤</span> Send
                                            </button>
                                          )}

                                          {canAcceptReject && (
                                            <>
                                              <button
                                                type="button"
                                                className="proforma-more-menu-item success"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveMoreMenuId(null);
                                                  handleUpdateProformaStatus(p, 'ACCEPTED');
                                                }}
                                              >
                                                <span style={{ width: '16px' }}>✓</span> Accept
                                              </button>
                                              <button
                                                type="button"
                                                className="proforma-more-menu-item danger"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveMoreMenuId(null);
                                                  handleUpdateProformaStatus(p, 'REJECTED');
                                                }}
                                              >
                                                <span style={{ width: '16px' }}>✕</span> Reject
                                              </button>
                                            </>
                                          )}

                                          {canConvert && (
                                            <>
                                              {!p.convertedOrderId && (
                                                <button
                                                  type="button"
                                                  className="proforma-more-menu-item convert-so"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMoreMenuId(null);
                                                    handleConvertProformaToOrder(p);
                                                  }}
                                                >
                                                  <span style={{ width: '16px' }}>➔</span> Convert to SO
                                                </button>
                                              )}
                                              {!p.convertedInvoiceId && (
                                                <button
                                                  type="button"
                                                  className="proforma-more-menu-item convert-inv"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMoreMenuId(null);
                                                    handleConvertProformaToInvoice(p);
                                                  }}
                                                >
                                                  <span style={{ width: '16px' }}>➔</span> Convert to Invoice
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* EXPANDABLE ROW (COLSPAN 7) */}
                            {isExpanded && (
                              <tr id={`proforma-details-${p.proformaId}`} className="proforma-expanded-detail-row">
                                <td colSpan="7" style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {/* Top Split: Customer Details & Upstream References */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                      {/* Customer Snapshot */}
                                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                          Customer Details & Addresses
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{p.customerName || '—'}</div>
                                        {p.company && <div style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{p.company}</div>}
                                        {(p.contactPerson || p.customerPhone || p.customerEmail) && (
                                          <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '4px' }}>
                                            {p.contactPerson && <span>Contact: {p.contactPerson} • </span>}
                                            {p.customerPhone && <span>📞 {p.customerPhone} </span>}
                                            {p.customerEmail && <span>✉ {p.customerEmail}</span>}
                                          </div>
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '11px', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                                          <div>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>Bill To: </span>
                                            {p.consigneeAddress || '—'}
                                            {p.consigneeGstin && <div style={{ fontWeight: 600, color: '#0369a1' }}>GSTIN: {p.consigneeGstin}</div>}
                                          </div>
                                          <div>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>Ship To: </span>
                                            {p.shippingAddress || p.consigneeAddress || '—'}
                                            {p.shippingGstin && <div style={{ fontWeight: 600, color: '#0369a1' }}>GSTIN: {p.shippingGstin}</div>}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Linked References */}
                                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                          Linked References & Terms
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Quotation</span>
                                            <strong>{p.quotationId || '—'}</strong>
                                            {p.quotationDate && <div style={{ fontSize: '10px', color: '#64748b' }}>{p.quotationDate}</div>}
                                          </div>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Customer PO</span>
                                            <strong>{p.customerPoNumber || '—'}</strong>
                                            {p.customerPoDate && <div style={{ fontSize: '10px', color: '#64748b' }}>{p.customerPoDate}</div>}
                                          </div>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Sales Order</span>
                                            <strong>{p.orderId || '—'}</strong>
                                            {p.orderDate && <div style={{ fontSize: '10px', color: '#64748b' }}>{p.orderDate}</div>}
                                          </div>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Delivery Challan</span>
                                            <strong>{p.dcNo || '—'}</strong>
                                            {p.dcDate && <div style={{ fontSize: '10px', color: '#64748b' }}>{p.dcDate}</div>}
                                          </div>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Valid Until</span>
                                            <strong style={{ color: isExpired ? '#b91c1c' : '#0f172a' }}>{p.validUntil || '—'}</strong>
                                          </div>
                                          <div>
                                            <span style={{ color: '#64748b', fontSize: '10.5px', display: 'block' }}>Converted Link</span>
                                            {p.convertedOrderId && <span style={{ color: '#059669', fontWeight: 600, display: 'block' }}>SO: {p.convertedOrderId}</span>}
                                            {p.convertedInvoiceId && <span style={{ color: '#d97706', fontWeight: 600, display: 'block' }}>INV: {p.convertedInvoiceId}</span>}
                                            {!p.convertedOrderId && !p.convertedInvoiceId && <span style={{ color: '#94a3b8' }}>—</span>}
                                          </div>
                                        </div>
                                        {(p.paymentTerms || p.deliveryTerms) && (
                                          <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', fontSize: '11px', color: '#475569' }}>
                                            {p.paymentTerms && <div><strong>Payment Terms:</strong> {p.paymentTerms}</div>}
                                            {p.deliveryTerms && <div><strong>Delivery Terms:</strong> {p.deliveryTerms}</div>}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Nested Line Items Table */}
                                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                                      <div style={{ padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Line Items ({Array.isArray(p.items) ? p.items.length : 0})
                                      </div>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: '11px' }}>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', width: '40px' }}>#</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>Product / Specification</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', width: '70px' }}>Qty</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right', width: '100px' }}>Rate (₹)</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', width: '70px' }}>GST</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right', width: '110px' }}>Line Total (₹)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Array.isArray(p.items) && p.items.length > 0 ? (
                                            p.items.map((it, idx) => (
                                              <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                                <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                                <td style={{ padding: '6px 10px' }}>
                                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.productName || it.name}</div>
                                                  {(it.productCode || it.sku) && (
                                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>SKU: {it.productCode || it.sku}</div>
                                                  )}
                                                  {it.productDetails && (
                                                    <div style={{ fontSize: '11px', color: '#475569' }}>{it.productDetails}</div>
                                                  )}
                                                  {Boolean(it.isSerialized || (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0)) && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                                                    <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                      <strong style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#0f172a' }}>Serial No(s): </strong>
                                                      {it.serialNumbers.map((sn, sIdx) => (
                                                        <span
                                                          key={sIdx}
                                                          title={`Click to track complete serial lifecycle: ${sn}`}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/serials?q=${encodeURIComponent(sn)}`);
                                                          }}
                                                          style={{
                                                            display: 'inline-block',
                                                            background: '#f1f5f9',
                                                            border: '1px solid #cbd5e1',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px',
                                                            fontFamily: 'monospace',
                                                            fontSize: '10.5px',
                                                            marginRight: '4px',
                                                            marginBottom: '2px',
                                                            cursor: 'pointer'
                                                          }}
                                                        >
                                                          {sn}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </td>
                                                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{it.quantity} {it.unit || ''}</td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                                  ₹{Number(it.unitPrice || it.rate || it.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                                                  {it.gst || it.gstPct || 18}%
                                                </td>
                                                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                                                  ₹{Number(it.lineTotal || it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>No item details available</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Bottom Actions and Summary Strip */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px' }}>
                                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewDocData({ type: 'PI', data: p });
                                            navigate(`/orders/proformas/${p.proformaId}`);
                                          }}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 14px',
                                            background: '#4338ca',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '5px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          👁 View Full Proforma
                                        </button>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                          Revision: <strong>R{p.revisionNumber || 1}</strong> {p.revisionReason ? `(${p.revisionReason})` : ''}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline', fontSize: '12px' }}>
                                        <span style={{ color: '#64748b' }}>
                                          Subtotal: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>₹{Number(p.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                        <span style={{ color: '#64748b' }}>
                                          Tax: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>₹{Number(p.gstTotal || p.taxTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                        {Number(p.discount || p.totalDiscount || 0) > 0 && (
                                          <span style={{ color: '#64748b' }}>
                                            Discount: <strong style={{ color: '#b91c1c', fontFamily: 'monospace' }}>-₹{Number(p.discount || p.totalDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                          </span>
                                        )}
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                          Grand Total: <strong style={{ color: '#4338ca', fontFamily: 'monospace' }}>₹{Number(p.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {proformasFillerCount > 0 && Array.from({ length: proformasFillerCount }).map((_, fIdx) => (
                        <tr key={`filler-pro-${fIdx}`} className="table-filler-row" aria-hidden="true">
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                          <td>&nbsp;</td>
                        </tr>
                      ))}
                    </>
                  )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={proformasPagination.showingStart}
                showingEnd={proformasPagination.showingEnd}
                total={proformasPagination.totalRecords}
                recordLabel="proformas"
                singularLabel="proforma"
                currentPage={proformasPagination.currentPage}
                totalPages={proformasPagination.totalPages}
                onPageChange={proformasPagination.goToPage}
                className="proforma-table-footer"
              />
            </div>
          )}
        </section>
      )}

      {/* CREATE PROFORMA INVOICE MODAL */}
      {proformaModalData && (
        <CreateProformaModal
          user={user}
          proforma={proformaModalData.proforma}
          isRevision={proformaModalData.isRevision}
          upstreamQuotation={proformaModalData.upstreamQuotation}
          upstreamOrder={proformaModalData.upstreamOrder}
          onClose={() => setProformaModalData(null)}
          onSuccess={(newPi) => {
            setSuccess(`Proforma Invoice ${newPi.proformaId} (${newPi.revisionId}) saved successfully.`);
            setTimeout(() => setSuccess(''), 4000);
            fetchAll();
            setSubView('proformas');
          }}
        />
      )}

      {/* CREATE SALES INVOICE MODAL */}
      {invModalData && (
        <CreateSalesInvoiceModal
          user={user}
          order={invModalData.order}
          challan={invModalData.challan}
          onClose={() => setInvModalData(null)}
          onSuccess={(newInv) => {
            setSuccess(`Sales Invoice ${newInv.invoiceId} created successfully.`);
            setTimeout(() => setSuccess(''), 3500);
            fetchAll();
            setSubView('invoices');
          }}
        />
      )}

      {/* VIEW DOCUMENT MODAL (PRINTABLE DC / INVOICE / PROFORMA) */}
      {viewDocData && (
        <ViewDocumentModal
          type={viewDocData.type}
          data={viewDocData.data}
          onClose={() => {
            const currentType = viewDocData.type;
            setViewDocData(null);
            if (activeDocId) {
              if (currentType === 'DC' || docType === 'delivery-challan') {
                navigate('/orders/delivery-challans');
              } else if (currentType === 'PI' || docType === 'proforma') {
                navigate('/orders/proformas');
              } else {
                navigate('/orders/invoices');
              }
            }
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// CREATE SALES INVOICE MODAL WRAPPER
// ==========================================
function CreateInvModal(props) {
  return <CreateSalesInvoiceModal {...props} />;
}

function getStatusStyle(status) {
  switch ((status || '').toUpperCase()) {
    case 'DRAFT':
      return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    case 'SENT':
      return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'ACCEPTED':
      return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
    case 'REVISED':
      return { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' };
    case 'REJECTED':
      return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
    case 'EXPIRED':
      return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
    case 'CANCELLED':
      return { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' };
    case 'CONVERTED':
      return { background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' };
    default:
      return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  }
}

// ==========================================
// VIEW DOCUMENT MODAL (PRINTABLE DC / INVOICE / PROFORMA)
// ==========================================
function ViewDocumentModal({ type, data, onClose }) {
  if (!data) return null;
  const isDc = type === 'DC';
  const isPi = type === 'PI';

  const docId = isDc
    ? (data.challanId || data.dcNumber || 'DC')
    : isPi
      ? (data.proformaId || data.id || 'PI')
      : (data.invoiceId || data.invoiceNo || 'INV');

  const filename = isDc
    ? getDcFilename(data)
    : isPi
      ? getProformaFilename(data)
      : getInvoiceFilename(data);

  return (
    <DocumentPreviewModal
      title={isDc ? 'Delivery Challan' : (isPi ? 'Proforma Invoice' : 'Sales Invoice')}
      docId={docId}
      docType={isDc ? 'dc' : (isPi ? 'pi' : 'inv')}
      status={data.status}
      filename={filename}
      data={data}
      onClose={onClose}
    >
      {isDc ? (
        <PrintableDeliveryChallan data={data} />
      ) : isPi ? (
        <PrintableProformaInvoice data={data} />
      ) : (
        <PrintableSalesInvoice data={data} />
      )}
    </DocumentPreviewModal>
  );
}
