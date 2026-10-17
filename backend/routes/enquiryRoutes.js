const express = require('express');
const router = express.Router();
const {
  getLeads,
  getQuotations,
  getQuotationQueue,
  updateQuotation,
  deleteQuotation,
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiryDetails,
  addFollowUp,
  updateStatus,
  solveEnquiry,
  createQuotation,
  createStandaloneQuotation,
  getNextQuotationIdPreview,
  getQuotationById,
  updateQuotationById,
  updateQuotationStatus
} = require('../controllers/enquiryController');

router.get('/leads', getLeads);
router.get('/quotations/next-id', getNextQuotationIdPreview);
router.get('/quotations', getQuotations);
router.post('/quotations', createStandaloneQuotation);
router.get('/quotation-queue', getQuotationQueue);
router.get('/quotation/:quotationId', getQuotationById);
router.put('/quotation/:quotationId', updateQuotationById);
router.put('/quotations/:quotationId', updateQuotationById);
router.patch('/quotation/:quotationId/status', updateQuotationStatus);
router.delete('/quotation/:id', deleteQuotation);
router.get('/', getEnquiries);
router.post('/', createEnquiry);
router.get('/:id', getEnquiryById);
router.put('/:id', updateEnquiryDetails);
router.post('/:id/follow-ups', addFollowUp);
router.patch('/:id/status', updateStatus);
router.post('/:id/quotation', createQuotation);
router.put('/:id/quotation', updateQuotation);
router.post('/:id/solve', solveEnquiry);

module.exports = router;
