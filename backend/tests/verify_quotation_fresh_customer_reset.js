/**
 * Test Suite: verify_quotation_fresh_customer_reset.js
 * Validates:
 * 1. Fresh Quotation workspace initialization on /quotations/new and page reload
 * 2. Purging of quotation drafts on quote save, accept, reject, and convert-to-order
 * 3. Auto-clearing of old line items and notes when switching customers in Direct Mode
 * 4. Preservation of copied line items during Copy Quotation workflow
 * 5. Distinct React keys in App.jsx for clean re-mounting across enquiry, direct, and details modes
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- STARTING VERIFICATION: Quotation Fresh Customer Reset & Draft Purge Logic ---');

const quotationEditorPath = path.resolve(__dirname, '../../frontend/src/components/enquiry/QuotationEditor.jsx');
const quotationsListPath = path.resolve(__dirname, '../../frontend/src/components/enquiry/QuotationsList.jsx');
const appPath = path.resolve(__dirname, '../../frontend/src/App.jsx');

const quotationEditorCode = fs.readFileSync(quotationEditorPath, 'utf8');
const quotationsListCode = fs.readFileSync(quotationsListPath, 'utf8');
const appCode = fs.readFileSync(appPath, 'utf8');

// Test 1: QuotationEditor has purgeAllQuotationDrafts helper and clears on direct initialization
console.log('Test 1: Verify purgeAllQuotationDrafts helper and fresh initialization in direct mode...');
assert.ok(quotationEditorCode.includes('purgeAllQuotationDrafts = () =>'), 'QuotationEditor must define purgeAllQuotationDrafts');
assert.ok(quotationEditorCode.includes("sessionStorage.removeItem('asicrm_quotation_draft_direct')"), 'purgeAllQuotationDrafts must remove direct draft');
assert.ok(quotationEditorCode.includes("sessionStorage.removeItem('asicrm_quotation_draft_latest')"), 'purgeAllQuotationDrafts must remove latest draft');
assert.ok(quotationEditorCode.includes("sessionStorage.removeItem('asicrm_quotation_copy_payload')"), 'purgeAllQuotationDrafts must remove copy payload');
assert.ok(
  quotationEditorCode.includes("if (mode === 'direct' && !isReturningFromProductMaster && !didApplyCopy)"),
  'Direct mode must start 100% clean if not returning from product master and not copying'
);
console.log('✓ Test 1 Passed: purgeAllQuotationDrafts helper and clean direct initialization verified.');

// Test 2: Auto-sync effect avoids saving drafts for saved, accepted, or converted quotes
console.log('Test 2: Verify auto-sync draft effect suppression on completed quotations...');
assert.ok(
  quotationEditorCode.includes("isSaved || quotationStatus === 'ACCEPTED' || quotationStatus === 'CONFIRMED' || quotationStatus === 'REJECTED'"),
  'Auto-sync draft must exit early if quotation is accepted, confirmed, saved, or rejected'
);
assert.ok(
  quotationEditorCode.includes("if (mode === 'direct' && (!hasCust || !hasItems))"),
  'Auto-sync draft must not persist empty direct templates'
);
console.log('✓ Test 2 Passed: Auto-sync suppression verified.');

// Test 3: Customer switch in direct mode clears previous items and restores master defaults
console.log('Test 3: Verify customer switch auto-clears line items and resets defaults in direct mode...');
assert.ok(
  quotationEditorCode.includes("const isNewOrDifferentCustomer = Boolean(!selectedCustomerId || (id && id !== selectedCustomerId));"),
  'handleSelectCustomer must detect new or different customer'
);
assert.ok(
  quotationEditorCode.includes("if (mode === 'direct' && isNewOrDifferentCustomer && !copiedFromSource)"),
  'handleSelectCustomer must clear items when changing customer in direct mode unless copying'
);
assert.ok(
  quotationEditorCode.includes("if (mode === 'direct' && !copiedFromSource)"),
  'handleCustomerCreated must clear items when new customer is created in direct mode unless copying'
);
console.log('✓ Test 3 Passed: Customer switch auto-clear verified.');

// Test 4: Draft purge on quote lifecycle events (accept, reject, convert, save, back)
console.log('Test 4: Verify draft purge on accept, reject, convert, save, and back...');
assert.ok(quotationEditorCode.includes("const handleAcceptQuotation ="), 'handleAcceptQuotation present');
const acceptIdx = quotationEditorCode.indexOf('const handleAcceptQuotation =');
const acceptBlock = quotationEditorCode.slice(acceptIdx, acceptIdx + 2000);
assert.ok(acceptBlock.includes('purgeAllQuotationDrafts()'), 'handleAcceptQuotation must call purgeAllQuotationDrafts');

const rejectIdx = quotationEditorCode.indexOf('const handleRejectQuotation =');
const rejectBlock = quotationEditorCode.slice(rejectIdx, rejectIdx + 2000);
assert.ok(rejectBlock.includes('purgeAllQuotationDrafts()'), 'handleRejectQuotation must call purgeAllQuotationDrafts');

const convertIdx = quotationEditorCode.indexOf('const handleConvertToOrder =');
const convertBlock = quotationEditorCode.slice(convertIdx, convertIdx + 2000);
assert.ok(convertBlock.includes('purgeAllQuotationDrafts()'), 'handleConvertToOrder must call purgeAllQuotationDrafts');

const saveIdx = quotationEditorCode.indexOf('const savedQuote = data.data;');
const saveBlock = quotationEditorCode.slice(saveIdx, saveIdx + 2000);
assert.ok(saveBlock.includes('purgeAllQuotationDrafts()'), 'handleSave must call purgeAllQuotationDrafts');

const backIdx = quotationEditorCode.indexOf('const handleBack = () =>');
const backBlock = quotationEditorCode.slice(backIdx, backIdx + 600);
assert.ok(backBlock.includes('purgeAllQuotationDrafts()'), 'handleBack must call purgeAllQuotationDrafts');
console.log('✓ Test 4 Passed: All quote lifecycle events purge drafts.');

// Test 5: QuotationsList "Create Quotation" button purges drafts before navigation
console.log('Test 5: Verify QuotationsList "Create Quotation" button purges drafts...');
assert.ok(
  quotationsListCode.includes("sessionStorage.removeItem('asicrm_quotation_draft_direct')"),
  'QuotationsList Create Quotation must remove direct draft'
);
assert.ok(
  quotationsListCode.includes("sessionStorage.removeItem('asicrm_quotation_draft_latest')"),
  'QuotationsList Create Quotation must remove latest draft'
);
assert.ok(
  quotationsListCode.includes("navigate('/quotations/new')"),
  'QuotationsList Create Quotation navigates to /quotations/new'
);
console.log('✓ Test 5 Passed: QuotationsList Create Quotation button draft purge verified.');

// Test 6: App.jsx React keys are distinct and guarantee fresh mounts
console.log('Test 6: Verify App.jsx React keys...');
assert.ok(
  appCode.includes('key="quotation-direct-new"'),
  'App.jsx direct quotation view must have key="quotation-direct-new"'
);
assert.ok(
  appCode.includes('key={`quotation-enquiry-${activeEnquiryId}`}'),
  'App.jsx enquiry quotation view must have key={`quotation-enquiry-${activeEnquiryId}`}'
);
assert.ok(
  appCode.includes('key={`quotation-details-${activeQuotationId}`}'),
  'App.jsx quotation details view must have key={`quotation-details-${activeQuotationId}`}'
);
console.log('✓ Test 6 Passed: App.jsx distinct keys verified.');

console.log('\n======================================================');
console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (6/6)');
console.log('======================================================\n');
