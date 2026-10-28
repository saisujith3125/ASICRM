/**
 * Active System Integration - Finance & Flow Controller
 */

const financeService = require('../services/financeService');

function getSummary(req, res) {
  try {
    const summary = financeService.getFinanceSummary(req.query);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] getSummary error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch finance summary.' });
  }
}

function getInward(req, res) {
  try {
    const inward = financeService.getInwardRegister(req.query);
    return res.json({ success: true, data: inward, count: inward.length });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] getInward error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch inward register.' });
  }
}

function getOutward(req, res) {
  try {
    const outward = financeService.getOutwardRegister(req.query);
    return res.json({ success: true, data: outward, count: outward.length });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] getOutward error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch outward register.' });
  }
}

function getSerial(req, res) {
  try {
    const { serialNumber } = req.params;
    const result = financeService.getSerialLifecycle(serialNumber);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] getSerial error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to trace serial number.' });
  }
}

function searchSerials(req, res) {
  try {
    const results = financeService.searchSerialNumbers(req.query.q || '');
    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] searchSerials error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to search serial numbers.' });
  }
}

function getUnbilledDcs(req, res) {
  try {
    const summary = financeService.getFinanceSummary(req.query);
    return res.json({
      success: true,
      data: summary.unbilledDcs || [],
      count: (summary.unbilledDcs || []).length,
      totalValue: summary.kpis?.unbilledDcTotalValue || 0
    });
  } catch (err) {
    console.error('[FINANCE CONTROLLER] getUnbilledDcs error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch unbilled DCs.' });
  }
}

module.exports = {
  getSummary,
  getInward,
  getOutward,
  getSerial,
  searchSerials,
  getUnbilledDcs
};
