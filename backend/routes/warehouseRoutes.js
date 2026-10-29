const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');

router.get('/', warehouseController.getAllWarehouses);
router.get('/search', warehouseController.searchWarehouseLocation);
router.post('/assign-bin', warehouseController.assignProductToBin);
router.post('/transfer-bin', warehouseController.transferStockBetweenBins);

module.exports = router;
