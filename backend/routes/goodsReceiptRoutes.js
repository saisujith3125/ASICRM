const express = require('express');
const router = express.Router();
const {
  getGoodsReceipts,
  getGoodsReceiptById
} = require('../controllers/purchaseOrderController');

// Goods Receipts endpoints
router.get('/', getGoodsReceipts);
router.get('/receipts/all', getGoodsReceipts);
router.get('/all', getGoodsReceipts);
router.get('/:id', getGoodsReceiptById);

module.exports = router;
