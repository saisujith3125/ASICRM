const financeService = require('../services/financeService');

/**
 * GET /api/serials
 * List all serial numbers with their full lifecycle and profitability status
 */
function getAllSerials(req, res) {
  try {
    const search = String(req.query.search || req.query.q || '').trim();
    const status = String(req.query.status || 'ALL').trim().toUpperCase();

    const result = financeService.getAllSerialLifecycles({ search, status });
    return res.status(200).json({
      success: true,
      data: result.serials,
      kpis: result.kpis,
      count: result.count
    });
  } catch (error) {
    console.error('Error in getAllSerials:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve serial numbers.' });
  }
}

/**
 * GET /api/serials/:serialNumber
 * Retrieve detailed provenance, inward PO, outward DC, invoice, and profit for a specific serial
 */
function getSerialByNumber(req, res) {
  try {
    const { serialNumber } = req.params;
    if (!serialNumber) {
      return res.status(400).json({ success: false, message: 'Serial number is required.' });
    }

    const result = financeService.getSerialLifecycle(serialNumber);
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getSerialByNumber:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve serial details.' });
  }
}

/**
 * GET /api/serials/search/suggest
 * Quick autocomplete suggestion for serial numbers
 */
function searchSerialSuggestions(req, res) {
  try {
    const query = String(req.query.q || '').trim();
    const suggestions = financeService.searchSerialNumbers(query);
    return res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error in searchSerialSuggestions:', error);
    return res.status(500).json({ success: false, message: 'Failed to search serial numbers.' });
  }
}

module.exports = {
  getAllSerials,
  getSerialByNumber,
  searchSerialSuggestions
};
