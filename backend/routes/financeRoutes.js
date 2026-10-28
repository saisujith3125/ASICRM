/**
 * Active System Integration - Finance & Flow Routes
 */

const express = require('express');
const router = express.Router();
const {
  getSummary,
  getInward,
  getOutward,
  getSerial,
  searchSerials,
  getUnbilledDcs
} = require('../controllers/financeController');

router.get('/summary', getSummary);
router.get('/inward', getInward);
router.get('/outward', getOutward);
router.get('/serials/search', searchSerials);
router.get('/serials/:serialNumber', getSerial);
router.get('/unbilled-dcs', getUnbilledDcs);

module.exports = router;
