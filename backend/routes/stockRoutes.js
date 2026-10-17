const express = require('express');
const router = express.Router();
const {
  getStocks,
  getProductHistory,
  getAllPriceHistory,
  createEntity,
  updateEntity,
  deleteEntity,
  createStockMovement,
  getStockMovements,
  getMovementDetail,
  voidStockMovement,
  correctStockMovement,
  getNextProductCodeEndpoint,
  validateProductCodeEndpoint,
  generateSerialNumbersEndpoint
} = require('../controllers/stockController');

router.get('/', getStocks);
router.get('/price-history', getAllPriceHistory);
router.get('/products/next-code', getNextProductCodeEndpoint);
router.get('/products/validate-code', validateProductCodeEndpoint);
router.get('/products/generate-serials', generateSerialNumbersEndpoint);
router.get('/products/:id/generate-serials', generateSerialNumbersEndpoint);
router.get('/products/:id/history', getProductHistory);

// Stock Movement Transaction Endpoints
router.post('/movements', createStockMovement);
router.get('/movements', getStockMovements);
router.get('/movements/:id', getMovementDetail);
router.put('/movements/:id', correctStockMovement);
router.delete('/movements/:id', voidStockMovement);

for (const type of ['categories','subcategories','brands','products']) {
  router.post(`/${type}`, (req,res) => createEntity(req,res,type));
  router.put(`/${type}/:id`, (req,res) => updateEntity(req,res,type));
  router.delete(`/${type}/:id`, (req,res) => deleteEntity(req,res,type));
}
module.exports = router;
