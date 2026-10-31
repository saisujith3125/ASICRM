const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== VERIFYING NO SKU / PRODUCT CODE IN ANY PDF OR DOCUMENT ===\n');

// 1. Check PrintableDeliveryChallan.jsx
const dcPath = path.join(__dirname, '../../frontend/src/components/documents/PrintableDeliveryChallan.jsx');
const dcContent = fs.readFileSync(dcPath, 'utf8');

assert(!dcContent.includes('SKU / Model'), 'PrintableDeliveryChallan must NOT contain "SKU / Model"');
assert(!dcContent.includes('dc-item-sku'), 'PrintableDeliveryChallan must NOT render "dc-item-sku"');
console.log('✔ PASS: PrintableDeliveryChallan has no SKU / Model or dc-item-sku rendering.');

// 2. Check PrintableSalesInvoice.jsx
const invPath = path.join(__dirname, '../../frontend/src/components/documents/PrintableSalesInvoice.jsx');
const invContent = fs.readFileSync(invPath, 'utf8');

assert(!invContent.includes('SKU: {it.sku}'), 'PrintableSalesInvoice must NOT render "SKU: {it.sku}"');
assert(!invContent.includes('doc-inv-item-sku'), 'PrintableSalesInvoice must NOT render "doc-inv-item-sku"');
console.log('✔ PASS: PrintableSalesInvoice has no SKU or doc-inv-item-sku rendering.');

// 3. Check PrintableProformaInvoice.jsx
const proPath = path.join(__dirname, '../../frontend/src/components/documents/PrintableProformaInvoice.jsx');
const proContent = fs.readFileSync(proPath, 'utf8');

assert(!proContent.includes('SKU / Model'), 'PrintableProformaInvoice must NOT render "SKU / Model"');
assert(!proContent.includes('doc-inv-item-sku'), 'PrintableProformaInvoice must NOT render "doc-inv-item-sku"');
console.log('✔ PASS: PrintableProformaInvoice has no SKU / Model or doc-inv-item-sku rendering.');

// 4. Check PrintableQuotation.jsx
const qtnPath = path.join(__dirname, '../../frontend/src/components/documents/PrintableQuotation.jsx');
const qtnContent = fs.readFileSync(qtnPath, 'utf8');

assert(!qtnContent.includes('SKU:'), 'PrintableQuotation must NOT render SKU');
assert(!qtnContent.includes('SKU / Model'), 'PrintableQuotation must NOT render SKU / Model');
console.log('✔ PASS: PrintableQuotation has no SKU or SKU / Model rendering.');

// 5. Check PrintablePurchaseOrder.jsx
const poPath = path.join(__dirname, '../../frontend/src/components/documents/PrintablePurchaseOrder.jsx');
const poContent = fs.readFileSync(poPath, 'utf8');

assert(!poContent.includes('SKU:'), 'PrintablePurchaseOrder must NOT render SKU');
assert(!poContent.includes('SKU / Model'), 'PrintablePurchaseOrder must NOT render SKU / Model');
console.log('✔ PASS: PrintablePurchaseOrder has no SKU or SKU / Model rendering.');

// 6. Check documentStyles.css global enforcement
const cssPath = path.join(__dirname, '../../frontend/src/components/documents/documentStyles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('.dc-item-sku'), 'documentStyles.css must include .dc-item-sku rule');
assert(cssContent.includes('display: none !important;'), 'documentStyles.css must enforce display: none !important;');
console.log('✔ PASS: documentStyles.css enforces display: none !important for any legacy SKU classes.');

console.log('\n======================================================');
console.log(' ALL 6 PDF & DOCUMENT SKU REMOVAL TESTS PASSED (100%)');
console.log('======================================================');
