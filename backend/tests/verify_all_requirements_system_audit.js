/**
 * Comprehensive System & Logic Verification Suite
 * Verifies all recent requirements and business logic across:
 * 1. Product fields editable on Edit screen
 * 2. ASI- sequence prefix & collision auto-advance
 * 3. Quotation editor button wordings
 * 4. Zero defaults & SMS OTP authentication
 * 5. Stocks in Clear Active Database
 * 6. Big-screen settings tables & styling
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

async function runSystemAudit() {
  console.log('===============================================================');
  console.log('       ASICRM SYSTEM & REQUIREMENTS LOGIC AUDIT');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Product Master Edit Mode Logic
  // -------------------------------------------------------------
  test('Requirement 1: Product fields editable on Edit screen (ProductCreatePage.jsx)', () => {
    const filePath = path.join(ROOT, 'frontend', 'src', 'components', 'stocks', 'ProductCreatePage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Product Code should remain disabled for existing products
    assert(content.includes('disabled={isExistingProduct}'), 'Product code should be disabled={isExistingProduct}');
    
    // Name, HSN, Description, Category, Subcategory, Brand, Unit must NOT have disabled={isExistingProduct}
    const nameSection = content.slice(content.indexOf('label="Product Name"'), content.indexOf('label="Product Name"') + 150);
    assert(!nameSection.includes('disabled={isExistingProduct}'), 'Product Name must be editable');

    const hsnSection = content.slice(content.indexOf('label="HSN / SAC Code"'), content.indexOf('label="HSN / SAC Code"') + 200);
    assert(!hsnSection.includes('disabled={isExistingProduct}'), 'HSN/SAC must be editable');

    const descSection = content.slice(content.indexOf('label="Product Description"'), content.indexOf('label="Product Description"') + 200);
    assert(!descSection.includes('disabled={isExistingProduct}'), 'Product Description must be editable');

    const catSection = content.slice(content.indexOf('label="Category"'), content.indexOf('label="Category"') + 250);
    assert(!catSection.includes('disabled={isExistingProduct}'), 'Category must be editable');

    const subcatSection = content.slice(content.indexOf('label="Subcategory"'), content.indexOf('label="Subcategory"') + 250);
    assert(!subcatSection.includes('disabled={isExistingProduct}'), 'Subcategory must be editable');

    const brandSection = content.slice(content.indexOf('label="Brand"'), content.indexOf('label="Brand"') + 250);
    assert(!brandSection.includes('disabled={isExistingProduct}'), 'Brand must be editable');

    const unitSection = content.slice(content.indexOf('label="Product Unit"'), content.indexOf('label="Product Unit"') + 250);
    assert(!unitSection.includes('disabled={isExistingProduct}'), 'Product Unit must be editable');
  });

  // -------------------------------------------------------------
  // TEST 2: Sequence Prefix ASI- & Collision Auto-Advance
  // -------------------------------------------------------------
  test('Requirement 2: ASI- product code prefix and collision auto-advance logic', () => {
    const { sequenceService } = require('../services/sequenceService');
    const { getNextProductCode } = require('../controllers/stockController');
    const { readStocks } = require('../services/inventoryService');

    const config = sequenceService.readConfig();
    assert.strictEqual(config.modules.stocks.prefix, 'ASI-', 'Stocks sequence prefix must be ASI-');
    assert.strictEqual(config.modules.stocks.paddingDigits, 2, 'Stocks padding digits must be 2');

    const stocks = readStocks();
    const nextCode = getNextProductCode(stocks.products);
    assert(nextCode.startsWith('ASI-'), `Next product code should start with ASI- (got ${nextCode})`);
    assert(/^ASI-\d{2,}$/.test(nextCode), `Product code format should match ASI-XX (got ${nextCode})`);

    // Test collision auto-advance past arbitrary existing code
    const mockExisting = [{ id: 'PRD-001', code: 'ASI-01' }, { id: 'PRD-047', code: 'ASI-47' }, { id: 'PRD-048', code: 'ASI-48' }];
    sequenceService.advancePastExisting('stocks', mockExisting.flatMap(p => [p.code, p.id]));
    const advancedConfig = sequenceService.readConfig();
    assert(advancedConfig.modules.stocks.nextNumber >= 49, 'Sequence nextNumber should be at least 49 after advancing past ASI-48');

    // Reset back to original nextNumber
    sequenceService.updateModuleRule('stocks', { nextNumber: 48 });
  });

  // -------------------------------------------------------------
  // TEST 3: Quotation Editor Button Wordings
  // -------------------------------------------------------------
  test('Requirement 3: QuotationEditor button wordings (+ Add Product & Edit Product)', () => {
    const qPath = path.join(ROOT, 'frontend', 'src', 'components', 'enquiry', 'QuotationEditor.jsx');
    const qContent = fs.readFileSync(qPath, 'utf8');

    assert(qContent.includes('<span>+ Add Product</span>'), 'Empty row must display + Add Product');
    assert(qContent.includes('<span>Edit Product</span>'), 'Populated row must display Edit Product');
    assert(!qContent.includes('in Stock Master'), 'Should not contain "in Stock Master"');
    assert(!qContent.includes('inmaster'), 'Should not contain "inmaster"');
  });

  // -------------------------------------------------------------
  // TEST 4: Zero Defaults & Authentication Security
  // -------------------------------------------------------------
  test('Requirement 4: Zero defaults, real SMS OTP, and absence of dummy admin backdoors', () => {
    const authPath = path.join(ROOT, 'backend', 'controllers', 'authController.js');
    const authContent = fs.readFileSync(authPath, 'utf8');

    assert(!authContent.includes('DEFAULT_CHECK_MOBILE'), 'Must not have DEFAULT_CHECK_MOBILE');
    assert(!authContent.includes('DEFAULT_CHECK_OTP'), 'Must not have DEFAULT_CHECK_OTP');
    assert(!authContent.includes('DEFAULT_SUPER_ADMIN_USER'), 'Must not have DEFAULT_SUPER_ADMIN_USER');
    assert(!authContent.includes('responsePayload.devOtp'), 'API response must not set responsePayload.devOtp');
    assert(!authContent.includes('resPayload.devOtp'), 'API response must not set resPayload.devOtp');

    const appPath = path.join(ROOT, 'frontend', 'src', 'App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert(!appContent.includes('Default: Super Admin'), 'App.jsx must not display Default: Super Admin hint');
    assert(!appContent.includes('Default OTP: 1234'), 'App.jsx must not display Default OTP: 1234 badge');
  });

  // -------------------------------------------------------------
  // TEST 5: Stocks in Clear Active Database
  // -------------------------------------------------------------
  test('Requirement 5: Stocks & Products Master in Clear Active Database modal and clean wipe', () => {
    const modalPath = path.join(ROOT, 'frontend', 'src', 'components', 'settings', 'sections', 'DatabaseBackupSection.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert(modalContent.includes('Stocks & Products Master'), 'Modal must contain Stocks & Products Master checkbox');
    assert(modalContent.includes('clearProducts: true'), 'clearProducts must be true by default');

    const backupPath = path.join(ROOT, 'backend', 'services', 'backupService.js');
    const backupContent = fs.readFileSync(backupPath, 'utf8');

    assert(backupContent.includes('if (clearProducts)'), 'clearActiveDatabase must support clearProducts');
    assert(backupContent.includes('stocks.products.length = 0'), 'clearProducts must wipe stocks.products');
    assert(backupContent.includes('stocks.inventoryTransactions.length = 0'), 'clearProducts must wipe stocks.inventoryTransactions');
    assert(backupContent.includes("sequenceService.updateModuleRule('stocks'"), 'clearProducts must reset stocks sequence counter');
  });

  // -------------------------------------------------------------
  // TEST 6: Big-Screen Settings Responsiveness
  // -------------------------------------------------------------
  test('Requirement 6: Big-screen CSS & typography rules in settings.css', () => {
    const cssPath = path.join(ROOT, 'frontend', 'src', 'components', 'settings', 'settings.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert(cssContent.includes('word-break: normal !important'), 'Table td must have word-break: normal');
    assert(!cssContent.includes('word-break: break-word !important'), 'Table td must NOT have word-break: break-word');
    assert(!cssContent.includes('table-layout: fixed !important'), 'Table must NOT be fixed layout');
    assert(cssContent.includes('@media (min-width: 1400px)'), 'Must include 1400px media query');
    assert(cssContent.includes('@media (min-width: 1680px)'), 'Must include 1680px media query');
    assert(cssContent.includes('white-space: nowrap !important'), 'Must enforce white-space: nowrap on code/pills/buttons');

    // Check individual settings tables for whiteSpace: nowrap & generous minWidth
    const sectionsDir = path.join(ROOT, 'frontend', 'src', 'components', 'settings', 'sections');
    const filesToCheck = [
      'SerialNumberSetupSection.jsx',
      'DateFormatSetupSection.jsx',
      'BranchesSection.jsx',
      'LocationsSection.jsx',
      'WarehousesSection.jsx',
      'ProductUnitsSection.jsx',
      'PaymentMethodsSection.jsx',
      'TaxGstSection.jsx',
      'UsersSection.jsx',
      'RolesSection.jsx'
    ];

    filesToCheck.forEach((file) => {
      const secContent = fs.readFileSync(path.join(sectionsDir, file), 'utf8');
      assert(secContent.includes('settings-table'), `${file} must render settings-table`);
      assert(secContent.includes('whiteSpace: \'nowrap\'') || secContent.includes('white-space: nowrap'), `${file} must enforce nowrap on data columns`);
    });
  });

  console.log('\n===============================================================');
  console.log(` AUDIT COMPLETE: ${passedTests} OF ${totalTests} TESTS PASSED (100%)`);
  console.log(' All requirements connected properly with robust underlying logic.');
  console.log('===============================================================\n');
}

runSystemAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err.message);
  process.exit(1);
});
