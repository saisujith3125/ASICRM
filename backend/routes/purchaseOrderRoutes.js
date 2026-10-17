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

// Purchase Orders endpoints
router.get('/', getPurchaseOrders);
router.get('/receipts/all', getGoodsReceipts);
router.get('/receipts/:id', getGoodsReceiptById);
router.get('/:id', getPurchaseOrderById);
router.post('/', createPurchaseOrder);
router.put('/:id', updatePurchaseOrder);
router.patch('/:id/status', updatePurchaseOrderStatus);
router.delete('/:id', deletePurchaseOrder);
router.post('/:id/receive', receiveGoods);

module.exports = router;
