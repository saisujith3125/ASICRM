const express = require('express');
const router = express.Router();
const {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  receiveGoods,
  getGoodsReceipts,
  getGoodsReceiptById
} = require('../controllers/purchaseOrderController');

// Middleware to normalize wildcard params to strings (handles IDs containing slashes like PO/001/2026)
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

// Purchase Orders endpoints
router.get('/', getPurchaseOrders);
router.get('/receipts/all', getGoodsReceipts);
router.get('/receipts/{*id}', normalizeParams, getGoodsReceiptById);
router.post('/', createPurchaseOrder);
router.patch('/{*id}/status', normalizeParams, updatePurchaseOrderStatus);
router.post('/{*id}/receive', normalizeParams, receiveGoods);
router.put('/{*id}', normalizeParams, updatePurchaseOrder);
router.delete('/{*id}', normalizeParams, deletePurchaseOrder);
router.get('/{*id}', normalizeParams, getPurchaseOrderById);

module.exports = router;
