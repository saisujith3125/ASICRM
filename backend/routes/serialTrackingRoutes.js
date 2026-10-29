const express = require('express');
const router = express.Router();
const serialTrackingController = require('../controllers/serialTrackingController');

router.get('/', serialTrackingController.getAllSerials);
router.get('/search/suggest', serialTrackingController.searchSerialSuggestions);
router.get('/:serialNumber', serialTrackingController.getSerialByNumber);

module.exports = router;
