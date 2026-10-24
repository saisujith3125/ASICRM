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

// Middleware to normalize wildcard params to strings (handles IDs containing slashes like ENQ/001/2026, QTN/001/2026)
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

router.get('/leads', getLeads);
router.get('/quotations/next-id', getNextQuotationIdPreview);
router.get('/quotations', getQuotations);
router.post('/quotations', createStandaloneQuotation);
router.get('/quotation-queue', getQuotationQueue);

// Quotation specific actions with wildcards
router.patch('/quotation/{*quotationId}/status', normalizeParams, updateQuotationStatus);
router.get('/quotation/{*quotationId}', normalizeParams, getQuotationById);
router.put('/quotation/{*quotationId}', normalizeParams, updateQuotationById);
router.put('/quotations/{*quotationId}', normalizeParams, updateQuotationById);
router.delete('/quotation/{*id}', normalizeParams, deleteQuotation);

// Enquiry collections & creation
router.get('/', getEnquiries);
router.post('/', createEnquiry);

// Enquiry actions with wildcards
router.post('/{*id}/follow-ups', normalizeParams, addFollowUp);
router.patch('/{*id}/status', normalizeParams, updateStatus);
router.post('/{*id}/quotation', normalizeParams, createQuotation);
router.put('/{*id}/quotation', normalizeParams, updateQuotation);
router.post('/{*id}/solve', normalizeParams, solveEnquiry);
router.put('/{*id}', normalizeParams, updateEnquiryDetails);
router.get('/{*id}', normalizeParams, getEnquiryById);

module.exports = router;
