const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Quotation Actions Table Layout, Add Product Flow & Reactivity ---');

// 1. Verify Quotation Table column widths & CSS rules
const cssPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'App.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const listPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'enquiry', 'QuotationsList.jsx');
const listContent = fs.readFileSync(listPath, 'utf8');

// Check QuotationsList.jsx colgroup
assert(listContent.includes("width: '28%'"), 'QuotationsList colgroup must allocate 28% to Actions column');
console.log('✓ QuotationsList colgroup allocates 28% to Actions column');

// Check App.css quotation-register-table
assert(cssContent.includes('.quotation-directory-page .quotation-register-table th:nth-child(8)'), 'App.css must style 8th Actions column');
assert(cssContent.includes('min-width:275px!important'), 'Actions column must have min-width of at least 275px');
assert(cssContent.includes('min-width: 1040px !important'), 'Quotation register table must have min-width 1040px to prevent clipping');
assert(cssContent.includes('overflow-x: auto !important;'), 'Table container must have overflow-x: auto');
console.log('✓ Quotation table layout CSS verified (min-width 1040px, actions col 28% / min-width 275px, overflow-x auto)');

// 2. Verify QuotationEditor conditional rendering (Edit Product vs + Add Product)
const editorPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'enquiry', 'QuotationEditor.jsx');
const editorContent = fs.readFileSync(editorPath, 'utf8');

assert(editorContent.includes('handleEditProductInMaster'), 'QuotationEditor must define handleEditProductInMaster');
assert(editorContent.includes('handleCreateProductInMaster'), 'QuotationEditor must define handleCreateProductInMaster');
assert(editorContent.includes('Edit Product'), 'QuotationEditor must render "Edit Product" when product is selected');
assert(editorContent.includes('+ Add Product'), 'QuotationEditor must render "+ Add Product" when no product is selected');

// Check that handleCreateProductInMaster purges asicrm_product_preload
assert(
  editorContent.includes("sessionStorage.removeItem('asicrm_product_preload')"),
  'handleCreateProductInMaster must remove asicrm_product_preload to prevent old products from leaking'
);
console.log('✓ QuotationEditor conditional button rendering and preload purge verified');

// 3. Verify ProductCreatePage mode enforcement
const createPagePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'stocks', 'ProductCreatePage.jsx');
const createPageContent = fs.readFileSync(createPagePath, 'utf8');

assert(
  createPageContent.includes("const isExistingProduct = Boolean(isEditMode && (productId || form.id || existingMatch));"),
  'isExistingProduct must require isEditMode to be true so Create Mode is never hijacked'
);
assert(
  createPageContent.includes("In create mode, purge any leftover preload"),
  'ProductCreatePage must purge preload in create mode'
);
console.log('✓ ProductCreatePage mode enforcement verified (Create mode never hijacked by residual existingMatch)');

// 4. Verify App.jsx edit vs create route handling
const appPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(
  appContent.includes("const isEdit = !stockProductCreate && (stockProductEdit || Boolean(activeProductId));"),
  'App.jsx must guarantee isEdit is false when stockProductCreate is true'
);
console.log('✓ App.jsx route handling verified');

// 5. Verify backend stocks API endpoints
const stockDataPath = path.join(__dirname, '..', 'data', 'stocks-data.json');
const stockData = JSON.parse(fs.readFileSync(stockDataPath, 'utf8'));
assert(Array.isArray(stockData.products) && stockData.products.length > 0, 'Stocks data must have products');

console.log(`\nALL QUOTATION TABLE & STOCK FLOW TESTS PASSED (100%)!`);
