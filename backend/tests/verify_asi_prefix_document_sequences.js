/**
 * Verification Test: ASI Document Prefix Standard across All Setup Pages and Sequences
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sequenceService } = require('../services/sequenceService');
const { getSettings, updateSectionSettings } = require('../controllers/settingsController');

console.log('=== STARTING ASICRM ASI PREFIX STANDARDIZATION AUDIT ===\n');

// 1. Verify access-control.json companySettings prefixes
const accessPath = path.join(__dirname, '..', 'data', 'access-control.json');
const accessData = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
assert.strictEqual(accessData.companySettings.invoiceSetup.prefix, 'ASI/INV/', 'Invoice Setup prefix must be ASI/INV/');
assert.strictEqual(accessData.companySettings.quotationSetup.prefix, 'ASI/QTN/', 'Quotation Setup prefix must be ASI/QTN/');
assert.strictEqual(accessData.companySettings.dcSetup.prefix, 'ASI/DC/', 'DC Setup prefix must be ASI/DC/');
console.log('✓ TEST 1 PASSED: access-control.json document setup prefixes verified (ASI/INV/, ASI/QTN/, ASI/DC/).');

// 2. Verify document-sequences.json and sequenceService summary
const summary = sequenceService.getSummary();
assert.strictEqual(summary.modules.invoices.prefix, 'ASI/INV/', 'Invoices sequence prefix must be ASI/INV/');
assert.strictEqual(summary.modules.deliveryChallans.prefix, 'ASI/DC/', 'Delivery Challans prefix must be ASI/DC/');
assert.strictEqual(summary.modules.purchaseOrders.prefix, 'ASI/PO/', 'Purchase Orders prefix must be ASI/PO/');
assert.strictEqual(summary.modules.enquiries.prefix, 'ASI/ENQ/', 'Enquiries prefix must be ASI/ENQ/');
assert.strictEqual(summary.modules.quotations.prefix, 'ASI/{FY}/QT', 'Quotations prefix must be ASI/{FY}/QT');
assert.strictEqual(summary.modules.stocks.prefix, 'ASI-', 'Stocks prefix must be ASI-');
console.log('✓ TEST 2 PASSED: sequenceService master sequence prefixes verified across all modules.');

// 3. Verify Live Previews for all modules
assert(summary.modules.invoices.livePreview.startsWith('ASI/INV/'), 'Invoice live preview must start with ASI/INV/');
assert(summary.modules.deliveryChallans.livePreview.startsWith('ASI/DC/'), 'DC live preview must start with ASI/DC/');
assert(summary.modules.purchaseOrders.livePreview.startsWith('ASI/PO/'), 'PO live preview must start with ASI/PO/');
assert(summary.modules.enquiries.livePreview.startsWith('ASI/ENQ/'), 'Enquiry live preview must start with ASI/ENQ/');
assert(summary.modules.quotations.livePreview.startsWith('ASI/26-27/QT'), 'Quotation live preview must start with ASI/26-27/QT');
assert(summary.modules.stocks.livePreview.startsWith('ASI-'), 'Stocks live preview must start with ASI-');
console.log('✓ TEST 3 PASSED: All live ID previews cleanly formatted with ASI brand prefix:');
console.log('    • Invoice:        ' + summary.modules.invoices.livePreview);
console.log('    • Delivery Challan:' + summary.modules.deliveryChallans.livePreview);
console.log('    • Quotation:       ' + summary.modules.quotations.livePreview);
console.log('    • Purchase Order:  ' + summary.modules.purchaseOrders.livePreview);
console.log('    • Enquiry:         ' + summary.modules.enquiries.livePreview);
console.log('    • Product Stock:   ' + summary.modules.stocks.livePreview);

// 4. Verify Frontend Setup Section files defaults
const invSection = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'sections', 'InvoiceSetupSection.jsx'), 'utf8');
assert(invSection.includes('ASI/INV/'), 'InvoiceSetupSection must default to ASI/INV/');

const qtnSection = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'sections', 'QuotationSetupSection.jsx'), 'utf8');
assert(qtnSection.includes('ASI/QTN/'), 'QuotationSetupSection must default to ASI/QTN/');

const dcSection = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'sections', 'DeliveryChallanSetupSection.jsx'), 'utf8');
assert(dcSection.includes('ASI/DC/'), 'DeliveryChallanSetupSection must default to ASI/DC/');
console.log('✓ TEST 4 PASSED: Frontend setup sections (Invoice, Quotation, DC) all default to ASI prefixes.');

// 5. Verify crmStore fallback generator patterns
const crmStore = fs.readFileSync(path.join(__dirname, '..', 'data', 'crmStore.js'), 'utf8');
assert(crmStore.includes('`ASI/INV/${String(nextInvoiceSeq)'), 'Invoice ID fallback must use ASI/INV/');
assert(crmStore.includes('`ASI/DC/${String(nextChallanSeq)'), 'DC ID fallback must use ASI/DC/');
assert(crmStore.includes('`ASI/PI/${String(nextProformaSeq)'), 'Proforma ID generator must use ASI/PI/');
assert(crmStore.includes('`ASI/ENQ/${String(nextEnquirySeq)'), 'Enquiry ID fallback must use ASI/ENQ/');
assert(crmStore.includes('`ASI/PO/${String(nextPurchaseOrderSeq)'), 'PO ID fallback must use ASI/PO/');
console.log('✓ TEST 5 PASSED: crmStore generator fallbacks verified with ASI prefixes.');

console.log('\n=======================================================');
console.log(' ALL ASI PREFIX STANDARDIZATION CHECKS PASSED (100%)');
console.log('=======================================================');
