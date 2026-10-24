/**
 * Automated Verification Suite for Date Format Setup Master & Document Settings
 * Verifies:
 * 1. Date Format Master Service & Endpoints
 * 2. Proposal Date Format (YYYY/MM/DD) and Document Date Format (DD/MM/YYYY)
 * 3. Settings Master Page Integration (DateFormatSetupSection)
 * 4. Document Physical Margins (20mm Left, 18mm Right)
 * 5. Customer Address to Subject line breathing room (44px / 11.6mm)
 * 6. Proposal Numbering Format (ASI/26-27/QT0007)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { dateSettingsService, DEFAULT_DATE_CONFIG } = require('../services/dateSettingsService');
const { sequenceService } = require('../services/sequenceService');
const {
  getDateFormatEndpoint,
  updateDateFormatEndpoint,
  resetDateFormatEndpoint
} = require('../controllers/settingsController');

console.log('=== STARTING ASICRM DATE FORMAT MASTER & DOCUMENT VERIFICATION ===\n');

// 1. Verify DateSettingsService Defaults
console.log('Test 1: Verify DateSettingsService Defaults...');
const summary = dateSettingsService.getSummary();
assert.strictEqual(summary.globalFormat, 'YYYY/MM/DD', 'Global default format must be YYYY/MM/DD');
assert.strictEqual(summary.globalSeparator, '/', 'Global separator must be /');
assert.strictEqual(summary.modules.quotations.format, 'YYYY/MM/DD', 'Quotation/Proposal format must be YYYY/MM/DD');
assert.strictEqual(summary.modules.invoices.format, 'DD/MM/YYYY', 'Invoice format must be DD/MM/YYYY');
assert.strictEqual(summary.modules.deliveryChallans.format, 'DD/MM/YYYY', 'Delivery Challan format must be DD/MM/YYYY');
assert.strictEqual(summary.modules.purchaseOrders.format, 'DD/MM/YYYY', 'Purchase Order format must be DD/MM/YYYY');
console.log('✓ DateSettingsService defaults verified.\n');

// 2. Verify Formatting Accuracy
console.log('Test 2: Verify Formatting Engine across various date shapes...');
const testDate = '2026-10-24T14:30:00.000Z';
const formattedProposal = dateSettingsService.formatModuleDate(testDate, 'quotations');
assert.strictEqual(formattedProposal, '2026/10/24', `Expected 2026/10/24, got ${formattedProposal}`);

const formattedInvoice = dateSettingsService.formatModuleDate(testDate, 'invoices');
assert.strictEqual(formattedInvoice, '24/10/2026', `Expected 24/10/2026, got ${formattedInvoice}`);

const formattedCustom1 = dateSettingsService.formatDate('2026-10-24', 'DD-MMM-YYYY');
assert.strictEqual(formattedCustom1, '24-Oct-2026', `Expected 24-Oct-2026, got ${formattedCustom1}`);

const formattedCustom2 = dateSettingsService.formatDate('2026-10-24', 'DD.MM.YYYY');
assert.strictEqual(formattedCustom2, '24.10.2026', `Expected 24.10.2026, got ${formattedCustom2}`);

const leapYearDate = dateSettingsService.formatDate('2028-02-29', 'YYYY/MM/DD');
assert.strictEqual(leapYearDate, '2028/02/29', `Expected 2028/02/29 for leap year, got ${leapYearDate}`);
console.log('✓ Formatting accuracy verified for all presets.\n');

// 3. Verify Settings Controller Endpoints
console.log('Test 3: Verify Settings Controller Endpoints...');
let getResData = null;
const mockGetRes = {
  json(data) { getResData = data; return this; },
  status(code) { console.error('GET error code:', code); return this; }
};
getDateFormatEndpoint({ headers: { 'x-user-id': 'USR-001' } }, mockGetRes);
assert(getResData && getResData.success, 'GET endpoint must return success: true');
assert(getResData.data.modules.quotations, 'GET endpoint must contain quotations module');

// Test Update Endpoint
let updateResData = null;
const mockUpdateRes = {
  json(data) { updateResData = data; return this; },
  status(code) { console.error('PUT error code:', code); return this; }
};
updateDateFormatEndpoint({
  headers: { 'x-user-id': 'USR-001' },
  body: {
    modules: {
      quotations: { format: 'YYYY/MM/DD', separator: '/' }
    }
  }
}, mockUpdateRes);
assert(updateResData && updateResData.success, 'PUT endpoint must return success: true');

// Test Reset Endpoint
let resetResData = null;
const mockResetRes = {
  json(data) { resetResData = data; return this; },
  status(code) { console.error('POST error code:', code); return this; }
};
resetDateFormatEndpoint({ headers: { 'x-user-id': 'USR-001' } }, mockResetRes);
assert(resetResData && resetResData.success, 'Reset endpoint must return success: true');
assert.strictEqual(resetResData.data.modules.quotations.format, 'YYYY/MM/DD');
console.log('✓ Endpoints (GET, PUT, POST reset) verified.\n');

// 4. Verify Master Settings Navigation & Page Integration
console.log('Test 4: Verify Master Settings Navigation & Page Registration...');
const layoutPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'SettingsLayout.jsx');
const pagePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'SettingsPage.jsx');
const sectionPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'settings', 'sections', 'DateFormatSetupSection.jsx');

assert(fs.existsSync(layoutPath), 'SettingsLayout.jsx must exist');
assert(fs.existsSync(pagePath), 'SettingsPage.jsx must exist');
assert(fs.existsSync(sectionPath), 'DateFormatSetupSection.jsx must exist');

const layoutContent = fs.readFileSync(layoutPath, 'utf8');
assert(layoutContent.includes("id: 'date-format'"), 'SettingsLayout must register date-format item');
assert(layoutContent.includes("label: 'Date Format Setup'"), 'SettingsLayout must label Date Format Setup');

const pageContent = fs.readFileSync(pagePath, 'utf8');
assert(pageContent.includes("import DateFormatSetupSection from './sections/DateFormatSetupSection'"), 'SettingsPage must import DateFormatSetupSection');
assert(pageContent.includes("case 'date-format':"), 'SettingsPage must render date-format case');
console.log('✓ Master Settings Page and Navigation integration verified.\n');

// 5. Verify Document Margins and Customer-Subject Spacing in CSS
console.log('Test 5: Verify Document Physical Margins & Breathing Room Spacing...');
const cssPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'documents', 'documentStyles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// Margins: Left 20mm, Right 18mm
assert(cssContent.includes('10mm 18mm 10mm 20mm !important'), 'Left margin must be exactly 20mm and Right margin must be exactly 18mm in quotation page');
assert(cssContent.includes('8mm 18mm 8mm 20mm !important'), 'Paged root must have 20mm left and 18mm right margins');

// Spacing: Customer Section margin-bottom (breathing room)
const customerSectionMatch = cssContent.match(/\.quotation-customer-section\s*\{[^}]*margin-bottom:\s*(\d+)px/);
assert(customerSectionMatch, 'Must find quotation-customer-section margin-bottom');
const gapPx = parseInt(customerSectionMatch[1], 10);
console.log(`Current address-to-subject margin-bottom: ${gapPx}px (${(gapPx * 25.4 / 96).toFixed(1)} mm)`);
assert(gapPx >= 40 && gapPx <= 48, `Breathing room gap must be between 40px and 48px, found ${gapPx}px`);
console.log('✓ Document margins and breathing room verified.\n');

// 6. Verify Proposal Number Format
console.log('Test 6: Verify Proposal Number Format...');
const quoteSeq = sequenceService.peekNextId('quotations');
console.log('Next proposal sequence preview:', quoteSeq);
assert(/^ASI\/\d{2}-\d{2}\/QT\d{4}$/.test(quoteSeq), `Proposal sequence must match ASI/{FY}/QT#### format, got: ${quoteSeq}`);
console.log('✓ Proposal number format verified.\n');

console.log('=======================================================');
console.log(' ALL DATE FORMAT MASTER & DOCUMENT CHECKS PASSED (100%)');
console.log('=======================================================');
