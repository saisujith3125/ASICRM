const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerBranches,
  addCustomerBranch,
  updateCustomerBranch,
  deleteCustomerBranch,
  addCustomerRequirement,
  updateCustomerRequirement,
  deleteCustomerRequirement,
  getCustomerQuotations,
  getCustomerDeliveryChallans,
  getCustomerInvoices
} = require('../controllers/customerController');

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.get('/:id/quotations', getCustomerQuotations);
router.get('/:id/delivery-challans', getCustomerDeliveryChallans);
router.get('/:id/invoices', getCustomerInvoices);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.patch('/:id/branches', updateCustomerBranches);
router.post('/:id/branches', addCustomerBranch);
router.put('/:id/branches/:branchId', updateCustomerBranch);
router.delete('/:id/branches/:branchId', deleteCustomerBranch);
router.post('/:id/requirements', addCustomerRequirement);
router.put('/:id/requirements/:requirementId', updateCustomerRequirement);
router.delete('/:id/requirements/:requirementId', deleteCustomerRequirement);

module.exports = router;
