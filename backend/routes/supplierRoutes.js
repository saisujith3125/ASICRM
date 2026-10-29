const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplierController');

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', createSupplier);
router.patch('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

module.exports = router;
