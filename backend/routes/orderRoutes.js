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

// Middleware to normalize wildcard params to strings (handles IDs containing slashes like DC/001/2026, INV/001/2026, QTN/001/2026)
const normalizeParams = (req, res, next) => {
  if (req.params) {
    for (const key of Object.keys(req.params)) {
      if (Array.isArray(req.params[key])) {
        req.params[key] = req.params[key].join('/');
      } else if (typeof req.params[key] === 'string') {
        req.params[key] = decodeURIComponent(req.params[key]);
      }
    }
  }
  next();
};

// Serial numbers pool from stocks
router.get('/available-serials', getAvailableSerialNumbers);

// Proforma Invoice endpoints (must be defined before /:id)
router.get('/proformas', getProformas);
router.post('/proformas', createProforma);
router.post('/proformas/{*id}/revise', normalizeParams, reviseProforma);
router.patch('/proformas/{*id}/status', normalizeParams, updateProformaStatus);
router.post('/proformas/{*id}/convert-to-order', normalizeParams, convertProformaToOrder);
router.post('/proformas/{*id}/convert-order', normalizeParams, convertProformaToOrder);
router.post('/proformas/{*id}/convert', normalizeParams, convertProformaToOrder);
router.post('/proformas/{*id}/convert-to-invoice', normalizeParams, convertProformaToInvoice);
router.post('/proformas/{*id}/convert-invoice', normalizeParams, convertProformaToInvoice);
router.put('/proformas/{*id}', normalizeParams, updateProforma);
router.get('/proformas/{*id}', normalizeParams, getProformaById);

// Delivery Challan endpoints
router.get('/delivery-challans', getDeliveryChallans);
router.post('/delivery-challans', createDeliveryChallan);
router.patch('/delivery-challans/{*id}/status', normalizeParams, updateDeliveryChallanStatus);
router.get('/delivery-challans/{*id}', normalizeParams, getDeliveryChallanById);

// Sales Invoice endpoints
router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.patch('/invoices/{*id}/payment', normalizeParams, updateInvoicePayment);
router.patch('/invoices/{*id}/status', normalizeParams, updateInvoiceStatus);
router.get('/invoices/{*id}', normalizeParams, getInvoiceById);

// Quotation conversion
router.post('/from-quotation/{*quotationId}', normalizeParams, createOrderFromQuotation);

// Sales Order endpoints
router.get('/', getOrders);
router.post('/', createOrder);
router.get('/{*id}', normalizeParams, getOrderById);

module.exports = router;
