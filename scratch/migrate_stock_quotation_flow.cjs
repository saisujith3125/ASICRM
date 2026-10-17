const fs = require('fs');
const path = require('path');

const STOCKS_FILE = path.join(__dirname, '..', 'backend', 'data', 'stocks-data.json');
const CRM_FILE = path.join(__dirname, '..', 'backend', 'data', 'crm-data.json');

console.log('--- Migration: Restoring Quotation Stock and Resetting Flow ---');

// 1. Process stocks-data.json
const stocksData = JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
const allTxns = stocksData.inventoryTransactions || [];

const qtTxns = allTxns.filter((t) =>
  (t.event && t.event.includes('Quotation')) ||
  t.referenceType === 'QT' ||
  (t.id && t.id.includes('TXN-QT'))
);

console.log(`Found ${qtTxns.length} quotation-related transactions in stocks-data.json.`);

const restorationByProd = {};
qtTxns.forEach((t) => {
  const pId = t.productId || t.productCode;
  const qty = Math.abs(Number(t.quantity || 0));
  restorationByProd[pId] = (restorationByProd[pId] || 0) + qty;
});

console.log('Restoring quantities to products:', restorationByProd);

stocksData.products.forEach((p) => {
  const restoreQty = (restorationByProd[p.id] || 0) + (restorationByProd[p.code] || 0);
  if (restoreQty > 0) {
    const oldStock = Number(p.stock || 0);
    p.stock = oldStock + restoreQty;
    console.log(`  Product ${p.code} (${p.name}): ${oldStock} -> ${p.stock} (+${restoreQty})`);
  }
});

// Remove the quotation transactions from inventory ledger
stocksData.inventoryTransactions = allTxns.filter((t) =>
  !(
    (t.event && t.event.includes('Quotation')) ||
    t.referenceType === 'QT' ||
    (t.id && t.id.includes('TXN-QT'))
  )
);

console.log(`Remaining inventory transactions: ${stocksData.inventoryTransactions.length} (was ${allTxns.length})`);
fs.writeFileSync(STOCKS_FILE, JSON.stringify(stocksData, null, 2), 'utf8');
console.log('✓ stocks-data.json updated successfully.');

// 2. Process crm-data.json
const crmData = JSON.parse(fs.readFileSync(CRM_FILE, 'utf8'));

let resetQuotationsCount = 0;
(crmData.quotations || []).forEach((q) => {
  if (q.stockDeducted) {
    resetQuotationsCount++;
  }
  q.stockDeducted = false;
  q.stockCommittedQuantities = {};
});

let resetProformasCount = 0;
(crmData.proformas || []).forEach((p) => {
  if (p.stockDeducted) {
    resetProformasCount++;
  }
  p.stockDeducted = false;
});

console.log(`Reset ${resetQuotationsCount} quotations and ${resetProformasCount} proformas to stockDeducted: false.`);
fs.writeFileSync(CRM_FILE, JSON.stringify(crmData, null, 2), 'utf8');
console.log('✓ crm-data.json updated successfully.');
console.log('--- Migration Complete ---');
