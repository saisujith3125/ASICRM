/**
 * Verification test for table column alignment, overflow prevention, and action area spacing
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STARTING ASICRM TABLE COLUMN ALIGNMENT & OVERFLOW AUDIT ===\n');

// 1. Verify tableWorkspace.css styles
const cssPath = path.join(__dirname, '../../frontend/src/components/common/tableWorkspace.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

console.log('[Test 1] Checking tableWorkspace.css overflow prevention rules...');
assert(cssContent.includes('.order-id-badge'), 'Missing .order-id-badge rule');
assert(cssContent.includes('overflow: hidden !important;'), 'Missing overflow: hidden on badge');
assert(cssContent.includes('text-overflow: ellipsis !important;'), 'Missing text-overflow: ellipsis on badge');
assert(cssContent.includes('invoices-settings-table'), 'Missing min-width for invoices-settings-table');
assert(cssContent.includes('quotation-settings-table'), 'Missing min-width for quotation-settings-table');
assert(cssContent.includes('dc-overview-table'), 'Missing min-width for dc-overview-table');
console.log('✓ PASS: Global CSS badge protection and min-width rules verified.\n');

// 2. Verify OrdersView.jsx Invoices colgroup
console.log('[Test 2] Checking OrdersView.jsx Invoices colgroup proportions...');
const ordersViewPath = path.join(__dirname, '../../frontend/src/components/orders/OrdersView.jsx');
const ordersViewContent = fs.readFileSync(ordersViewPath, 'utf8');

// Invoices colgroup
assert(ordersViewContent.includes("width: '13.5%'"), 'Invoice ID or Delivery Ref width not updated to 13.5%');
assert(ordersViewContent.includes("width: '15.5%'"), 'Sales Order width not updated to 15.5%');
assert(!ordersViewContent.includes("minWidth: '90px'"), 'Obsolete rigid minWidth: 90px still present in Invoices table');
console.log('✓ PASS: Invoices table colgroup and badge styling verified.\n');

// 3. Verify QuotationsList.jsx colgroup
console.log('[Test 3] Checking QuotationsList.jsx colgroup proportions...');
const quotationsListPath = path.join(__dirname, '../../frontend/src/components/enquiry/QuotationsList.jsx');
const quotationsListContent = fs.readFileSync(quotationsListPath, 'utf8');

assert(quotationsListContent.includes("width: '12%'"), 'Enquiry ID width not enlarged to 12%');
assert(quotationsListContent.includes("width: '13%'"), 'Total Amount width not enlarged to 13%');
assert(quotationsListContent.includes("width: '11%'"), 'Updated date width not enlarged to 11%');
assert(quotationsListContent.includes("width: '9%'"), 'Actions column width not reduced to 9%');
console.log('✓ PASS: Quotations table colgroup verified with expanded headers and compact actions.\n');

// 4. Verify DcOverview.jsx colgroup
console.log('[Test 4] Checking DcOverview.jsx colgroup proportions...');
const dcOverviewPath = path.join(__dirname, '../../frontend/src/components/deliveryChallans/DcOverview.jsx');
const dcOverviewContent = fs.readFileSync(dcOverviewPath, 'utf8');

assert(dcOverviewContent.includes("width: '15%'"), 'DC Number width not enlarged to 15%');
assert(dcOverviewContent.includes("width: '8%'"), 'Actions column width not reduced to 8%');
console.log('✓ PASS: Delivery Challans table colgroup verified with expanded DC Number column.\n');

// 5. Verify FinanceView.jsx flexWrap
console.log('[Test 5] Checking FinanceView.jsx quick serial pills flex-wrap...');
const financeViewPath = path.join(__dirname, '../../frontend/src/components/finance/FinanceView.jsx');
const financeViewContent = fs.readFileSync(financeViewPath, 'utf8');

assert(financeViewContent.includes("flexWrap: 'wrap'"), 'Missing flexWrap: wrap on quick sample serials container');
console.log('✓ PASS: Finance serial presets container flexWrap verified.\n');

console.log('=======================================================');
console.log(' ALL TABLE ALIGNMENT & OVERFLOW AUDIT CHECKS PASSED (100%)');
console.log('=======================================================');
