const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sequenceService, formatSerial } = require('../services/sequenceService');

console.log('--- STARTING VERIFICATION OF ASICRM DOCUMENT MARGINS & PROPOSAL NUMBERING ---');

// 1. Verify documentStyles.css Margins
const cssPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'documents', 'documentStyles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// Verify Left margin: exactly 20mm (2cm), Right margin: exactly 18mm (1.8cm)
assert(
  cssContent.includes('padding: 10mm 18mm 10mm 20mm !important'),
  'Quotation page must use 20mm Left, 18mm Right margins'
);
assert(
  cssContent.includes('padding: 8mm 18mm 8mm 20mm !important'),
  'Paged documents (DC, Invoice, Proforma, PO) must use 20mm Left, 18mm Right margins'
);
assert(
  cssContent.includes('.doc-po-root .doc-paged-page') &&
  cssContent.includes('left: 106mm'),
  'PO documents must respect margins and watermarks must be centered at 106mm'
);
console.log('✓ TEST 1 PASSED: documentStyles.css margins verified: exactly 20mm Left, 18mm Right across all documents.');

// 2. Verify Sequence Service & Financial Year Tokens
const rule = {
  prefix: 'ASI/{FY}/QT',
  suffix: '',
  paddingDigits: 4,
  startingNumber: 1,
  nextNumber: 7,
  resetPolicy: 'FINANCIAL_YEAR',
  activeYear: 2026,
  financialYearLabel: '2026-27'
};

const num1 = formatSerial(rule, 1, new Date('2026-10-24'));
assert.strictEqual(num1, 'ASI/26-27/QT0001', 'Serial 1 must format as ASI/26-27/QT0001');

const num2 = formatSerial(rule, 2, new Date('2026-10-24'));
assert.strictEqual(num2, 'ASI/26-27/QT0002', 'Serial 2 must format as ASI/26-27/QT0002');

const num7 = formatSerial(rule, 7, new Date('2026-10-24'));
assert.strictEqual(num7, 'ASI/26-27/QT0007', 'Serial 7 must format as ASI/26-27/QT0007');

console.log('✓ TEST 2 PASSED: Financial Year sequence formatting matches ASI/26-27/QT0001, QT0002, QT0007.');

// 3. Verify sequenceService.getSummary()
const summary = sequenceService.getSummary();
assert(summary.modules.quotations, 'Quotations module must exist in sequences');
assert.strictEqual(summary.modules.quotations.prefix, 'ASI/{FY}/QT');
assert.strictEqual(summary.modules.quotations.paddingDigits, 4);
assert.strictEqual(summary.modules.quotations.resetPolicy, 'FINANCIAL_YEAR');
assert(summary.currentFinancialYear, 'Current financial year must be present in summary');
console.log(`✓ TEST 3 PASSED: sequenceService summary verified. Active FY: ${summary.currentFinancialYear} (${summary.currentFinancialYearShort}). Quotation live preview: ${summary.modules.quotations.livePreview}`);

// 4. Verify Document Formatters & Date Format
const { formatProposalDate } = require('../../frontend/src/components/documents/documentFormatters');
const d1 = formatProposalDate('2026-10-24T09:42:05Z');
assert.strictEqual(d1, '2026/10/24', 'Proposal date must format as YYYY/MM/DD');

const d2 = formatProposalDate('2026-04-01');
assert.strictEqual(d2, '2026/04/01', 'Proposal date must format as YYYY/MM/DD');

const d3 = formatProposalDate('24/10/2026');
assert.strictEqual(d3, '2026/10/24', 'Proposal date must format as YYYY/MM/DD');

console.log('✓ TEST 4 PASSED: Proposal date formatting verified as exact YYYY/MM/DD (e.g. 2026/10/24).');

console.log('--- ALL ASICRM DOCUMENT & PROPOSAL TESTS PASSED SUCCESSFULLY ---');
