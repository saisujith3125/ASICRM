const { readStocks, writeStocks, addStock, deductStock, validateSerialNumbersForInward, validateAvailableStock, getProductBalance } = require('../services/inventoryService');

/**
 * Quotations are commercial proposals and NEVER deduct physical stock.
 * Physical stock deduction happens strictly when Delivery Challans are DELIVERED, or via Sales Invoices.
 */
function commitQuotationStock(quotation, user) {
  return { success: true, notApplicable: true, message: 'Quotations do not reduce physical stock.' };
}

function revertQuotationStock(quotation, user, reason = 'Status changed') {
  return { success: true, notApplicable: true };
}

function reconcileQuotationStock(quotation, newItems, user) {
  return { success: true, notApplicable: true };
}

module.exports = {
  readStocks,
  writeStocks,
  commitQuotationStock,
  revertQuotationStock,
  reconcileQuotationStock,
  addStock,
  deductStock,
  validateSerialNumbersForInward,
  validateAvailableStock,
  getProductBalance
};
