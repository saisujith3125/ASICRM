const express = require('express');
const router = express.Router();
const {
  getGoodsReceipts,
  getGoodsReceiptById
} = require('../controllers/purchaseOrderController');

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

// Goods Receipts endpoints
router.get('/', getGoodsReceipts);
router.get('/receipts/all', getGoodsReceipts);
router.get('/all', getGoodsReceipts);
router.get('/{*id}', normalizeParams, getGoodsReceiptById);

module.exports = router;
