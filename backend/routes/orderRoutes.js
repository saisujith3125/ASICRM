const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrderById,
  createOrder,
  createOrderFromQuotation,
  getDeliveryChallans,
  getDeliveryChallanById,
  createDeliveryChallan,
  updateDeliveryChallanStatus,
  getAvailableSerialNumbers,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoicePayment,
  updateInvoiceStatus,
  getProformas,
  getProformaById,
  createProforma,
  updateProforma,
  reviseProforma,
  updateProformaStatus,
  convertProformaToOrder,
  convertProformaToInvoice
} = require('../controllers/orderController');

// Serial numbers pool from stocks
router.get('/available-serials', getAvailableSerialNumbers);

// Proforma Invoice endpoints (must be defined before /:id)
router.get('/proformas', getProformas);
router.get('/proformas/:id', getProformaById);
router.post('/proformas', createProforma);
router.put('/proformas/:id', updateProforma);
router.post('/proformas/:id/revise', reviseProforma);
router.patch('/proformas/:id/status', updateProformaStatus);
router.post('/proformas/:id/convert-to-order', convertProformaToOrder);
router.post('/proformas/:id/convert-order', convertProformaToOrder);
router.post('/proformas/:id/convert', convertProformaToOrder);
router.post('/proformas/:id/convert-to-invoice', convertProformaToInvoice);
router.post('/proformas/:id/convert-invoice', convertProformaToInvoice);

// Delivery Challan endpoints
router.get('/delivery-challans', getDeliveryChallans);
router.get('/delivery-challans/:id', getDeliveryChallanById);
router.post('/delivery-challans', createDeliveryChallan);
router.patch('/delivery-challans/:id/status', updateDeliveryChallanStatus);

// Sales Invoice endpoints
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/payment', updateInvoicePayment);
router.patch('/invoices/:id/status', updateInvoiceStatus);

// Sales Order endpoints
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/from-quotation/:quotationId', createOrderFromQuotation);

module.exports = router;
