const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACT_DIR = 'C:/Users/pc/.gemini/antigravity/brain/a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 1x1 transparent red pixel base64 test images for branding
const TEST_BRAND_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAMklEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeBjIAAAGFsmQGAAAAAElFTkSuQmCC';
const TEST_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAARElEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4GwwOAABhS62vwAAAABJRU5ErkJggg==';
const TEST_SEAL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAPElEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4M3V4AAEa7Bv1AAAAAElFTkSuQmCC';

async function run() {
  console.log('--- STARTING COMPREHENSIVE QUOTATION WORKFLOW MASTER TEST ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const testResults = {
    test1_emptyStateRemoved: false,
    test2_zeroBranchCustomerHidesBranchAndEnquiry: false,
    test3_multiBranchCustomerShowsBranchSelector: false,
    test4_branchSelectionEnablesEnquiryLink: false,
    test5_customerChangeResetsBranchAndEnquiry: false,
    test6_duplicateProductBlocked: false,
    test7_priceBelowMinPriceBlocked: false,
    test8_singleAddProductToMasterButton: false,
    test9_pdfHidesDiscountColumnAndDiscountRow: false,
    test10_pdfShowsNetEffectiveUnitPriceAndTotals: false,
    test11_pdfRendersBrandingCompanyIsoAndSeal: false
  };

  try {
    // Navigate to base URL to initialize localStorage
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*']
      }));
    });

    // Update Settings via backend API with test branding assets and ISO certification
    await page.evaluate(async (logo, sig, seal) => {
      const payload = {
        name: 'Active System Integration',
        iso: 'ISO 9001:2015 & ISO 27001 Certified',
        street: 'Plot No. 10A, Perumal Kovil Street',
        street2: 'Sivabootham, Vanagaram',
        city: 'Chennai',
        pincode: '600095',
        state: 'Tamil Nadu',
        country: 'India',
        phone: '09994126666',
        mobile: '98943 26666, 91500 26666',
        email: 'admin@asi.ind.in',
        logoUrl: logo,
        signatureUrl: sig,
        sealUrl: seal
      };

      await fetch('http://127.0.0.1:5000/api/settings/company', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'USR-001'
        },
        body: JSON.stringify(payload)
      });
    }, TEST_BRAND_LOGO, TEST_SIGNATURE, TEST_SEAL);

    // 1. Navigate to /quotations/new
    console.log('Navigating to /quotations/new...');
    await page.goto('http://localhost:5173/quotations/new', { waitUntil: 'networkidle2' });
    await sleep(1500);

    // TEST 1: Verify empty-state placeholder box is NOT rendered
    const emptySlotExists = await page.evaluate(() => {
      const slot = document.querySelector('.selected-customer-empty-slot');
      return slot !== null && slot.offsetParent !== null;
    });
    testResults.test1_emptyStateRemoved = !emptySlotExists;
    console.log('✓ TEST 1 - Empty State Placeholder Box Removed:', testResults.test1_emptyStateRemoved);

    // TEST 8: Verify exactly one "+ Add Product to Master" button exists
    const addProductMasterButtonsCount = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter(b => b.textContent && b.textContent.includes('Add Product to Master')).length;
    });
    testResults.test8_singleAddProductToMasterButton = (addProductMasterButtonsCount === 1);
    console.log(`✓ TEST 8 - Single Add Product to Master Button Count (${addProductMasterButtonsCount}):`, testResults.test8_singleAddProductToMasterButton);

    // Helper: Select customer by text query
    async function selectCustomer(nameQuery) {
      // Find the customer input (inside .quotation-customer-row)
      const custInput = await page.$('.quotation-customer-row .sps-direct-input');
      if (!custInput) throw new Error('Customer direct input not found');

      // Click clear button if present
      const clearBtn = await page.$('.quotation-customer-row .sps-clear-btn');
      if (clearBtn) {
        await clearBtn.click();
        await sleep(300);
      }

      await custInput.click();
      await page.evaluate(() => {
        const inp = document.querySelector('.quotation-customer-row .sps-direct-input');
        if (inp) inp.value = '';
      });
      await custInput.type(nameQuery);
      await sleep(600);

      // Click option in dropdown
      const selected = await page.evaluate((targetName) => {
        const options = Array.from(document.querySelectorAll('.scs-option-item'));
        const match = options.find(el => el.textContent.includes(targetName));
        if (match) {
          match.click();
          return true;
        }
        return false;
      }, nameQuery);

      await sleep(800);
      return selected;
    }

    // TEST 2: Customer with 0 branches (CUST-001 Aarav Sharma)
    console.log('Selecting Customer with 0 branches (Aarav Sharma)...');
    await selectCustomer('Aarav Sharma');

    const test2State = await page.evaluate(() => {
      const text = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const hasBranchSelect = selects.some(s => s.innerHTML.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      const hasCustomerSummary = text.includes('Aarav Sharma') && (text.includes('📞') || text.includes('✉️') || text.includes('📍'));
      return { hasBranchSelect, hasEnquirySelect, hasCustomerSummary };
    });
    testResults.test2_zeroBranchCustomerHidesBranchAndEnquiry = (!test2State.hasBranchSelect && !test2State.hasEnquirySelect && test2State.hasCustomerSummary);
    console.log('✓ TEST 2 - Customer with 0 branches hides branch selector & enquiry link:', testResults.test2_zeroBranchCustomerHidesBranchAndEnquiry, test2State);

    // TEST 3: Customer with multiple branches (CUST-002 Priya Patel)
    console.log('Selecting Customer with multiple branches (Priya Patel)...');
    await selectCustomer('Priya Patel');

    const test3State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const hasBranchSelect = selects.some(s => s.innerHTML.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return { hasBranchSelect, hasEnquirySelect };
    });
    testResults.test3_multiBranchCustomerShowsBranchSelector = (test3State.hasBranchSelect && !test3State.hasEnquirySelect);
    console.log('✓ TEST 3 - Multi-branch customer shows branch selector and waits for branch selection:', testResults.test3_multiBranchCustomerShowsBranchSelector, test3State);

    // TEST 4: Select a branch and verify Link Enquiry now appears
    console.log('Selecting a branch...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const branchSelect = selects.find(s => s.innerHTML.includes('Select Branch'));
      if (branchSelect && branchSelect.options.length > 1) {
        branchSelect.selectedIndex = 1;
        branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(600);

    const test4State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return hasEnquirySelect;
    });
    testResults.test4_branchSelectionEnablesEnquiryLink = test4State;
    console.log('✓ TEST 4 - Branch selection enables Link Enquiry control:', testResults.test4_branchSelectionEnablesEnquiryLink);

    // TEST 5: Changing customer resets previous branch and enquiry links
    console.log('Changing customer back to Aarav Sharma to verify reset...');
    await selectCustomer('Aarav Sharma');

    const test5State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const hasBranchSelect = selects.some(s => s.innerHTML.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return !hasBranchSelect && !hasEnquirySelect;
    });
    testResults.test5_customerChangeResetsBranchAndEnquiry = test5State;
    console.log('✓ TEST 5 - Changing customer resets previous branch and enquiry links:', testResults.test5_customerChangeResetsBranchAndEnquiry);

    // Re-select Priya Patel with a branch for the complete quotation
    await selectCustomer('Priya Patel');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.quotation-customer-row select'));
      const branchSelect = selects.find(s => s.innerHTML.includes('Select Branch'));
      if (branchSelect && branchSelect.options.length > 1) {
        branchSelect.selectedIndex = 1;
        branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);

    // TEST 6: Add Product and Duplicate Product Prevention
    console.log('Selecting Product PROD-000001 (Dahua 5MP IR Bullet Camera) in row 1...');
    const firstRowInput = await page.$('.quotation-items-table tbody tr:first-child .sps-direct-input');
    if (!firstRowInput) throw new Error('First row product input not found');

    await firstRowInput.click();
    await firstRowInput.click();
    await firstRowInput.type('Dahua 5MP');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(800);

    // Verify row 1 selected
    const row1Selected = await page.evaluate(() => {
      const rowDesc = document.querySelector('.quotation-items-table tbody tr:first-child .quotation-desc-textarea');
      const val = rowDesc ? rowDesc.value : '';
      return Boolean(val);
    });
    console.log('Row 1 Product Auto-loaded:', row1Selected);

    // Add another row
    console.log('Adding row 2 and attempting to select the duplicate product...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addRowBtn = buttons.find(b => b.textContent.includes('Add Row'));
      if (addRowBtn) addRowBtn.click();
    });
    await sleep(500);

    const secondRowInput = await page.$('.quotation-items-table tbody tr:nth-child(2) .sps-direct-input');
    if (secondRowInput) {
      await secondRowInput.click();
      await secondRowInput.type('Dahua 5MP');
      await sleep(500);

      // Check if Dahua 5MP is disabled in row 2 dropdown
      const duplicateOptionDisabled = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.sps-portal-dropdown .sps-option-item'));
        const prodItem = items.find(el => el.textContent.includes('Dahua 5MP') || el.textContent.includes('CAM-IPC-001'));
        return prodItem ? prodItem.classList.contains('is-disabled') || prodItem.innerText.includes('Added') : false;
      });

      // Try pressing Enter
      await page.keyboard.press('Enter');
      await sleep(600);

      // Verify row 2 was NOT populated with Dahua
      const row2HasProduct = await page.evaluate(() => {
        const rowDesc = document.querySelector('.quotation-items-table tbody tr:nth-child(2) .quotation-desc-textarea');
        return Boolean(rowDesc && rowDesc.value);
      });

      testResults.test6_duplicateProductBlocked = (duplicateOptionDisabled && !row2HasProduct);
      console.log('✓ TEST 6 - Duplicate product prevented:', testResults.test6_duplicateProductBlocked, {
        duplicateOptionDisabled,
        row2HasProduct
      });

      // Clean up row 2
      await page.evaluate(() => {
        const delBtns = Array.from(document.querySelectorAll('.quotation-delete-btn'));
        if (delBtns[1]) delBtns[1].click();
      });
      await sleep(500);
    }

    // TEST 7: Price Validation below Configured Base Price
    console.log('Testing price validation below configured base price (dealerPrice = 4850)...');
    // Set price to 4000 (below minPrice 4850)
    await page.evaluate(() => {
      const priceInputs = Array.from(document.querySelectorAll('.quotation-price-input'));
      if (priceInputs[0]) {
        priceInputs[0].value = '4000';
        priceInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        priceInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);

    // Click Save Quotation
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => b.textContent.includes('SAVE') || b.textContent.includes('Save'));
      if (saveBtn) saveBtn.click();
    });
    await sleep(600);

    const priceValidationMsg = await page.evaluate(() => {
      const errBox = document.querySelector('.crm-alert-box.error');
      return errBox ? errBox.innerText : '';
    });
    testResults.test7_priceBelowMinPriceBlocked = priceValidationMsg.includes("Quotation price cannot be lower than the product's configured price");
    console.log('✓ TEST 7 - Price validation error message:', testResults.test7_priceBelowMinPriceBlocked, priceValidationMsg);

    // Correct price back to 5200
    await page.evaluate(() => {
      const priceInputs = Array.from(document.querySelectorAll('.quotation-price-input'));
      if (priceInputs[0]) {
        priceInputs[0].value = '5200';
        priceInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        priceInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);

    // TEST 9 & 10: Toggle Discount and Round Off, then inspect PDF Preview
    console.log('Enabling Show Discount and Round Off Total in editor...');
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const discCb = checkboxes.find(c => c.nextElementSibling?.textContent?.includes('Show Discount'));
      const roundCb = checkboxes.find(c => c.nextElementSibling?.textContent?.includes('Round Off'));
      if (discCb && !discCb.checked) discCb.click();
      if (roundCb && !roundCb.checked) roundCb.click();
    });
    await sleep(500);

    // Set 10% discount on row 1 in editor
    await page.evaluate(() => {
      const discInput = document.querySelector('.quotation-discount-input');
      if (discInput) {
        discInput.value = '10';
        discInput.dispatchEvent(new Event('input', { bubbles: true }));
        discInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(600);

    // Take editor screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_quotation_editor_master.png'), fullPage: true });

    // Open PDF Preview Modal
    console.log('Opening PDF Preview modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const previewBtn = buttons.find(b => b.textContent.includes('Quotation PDF'));
      if (previewBtn) previewBtn.click();
    });
    await sleep(1500);

    // Take PDF preview screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_quotation_print_preview.png'), fullPage: true });

    // Inspect the rendered PDF table in PrintableQuotation
    const pdfDetails = await page.evaluate(() => {
      const modal = document.querySelector('.crm-modal-container') || document.body;
      const ths = Array.from(modal.querySelectorAll('.quotation-table thead th')).map(t => t.textContent.trim());
      const hasDiscountHeader = ths.some(h => h.toLowerCase().includes('discount') || h.toLowerCase().includes('disc'));
      
      const totalRows = Array.from(modal.querySelectorAll('.quotation-total-row'));
      const totalLabels = totalRows.map(r => r.querySelector('.quotation-total-label')?.textContent?.trim() || '');
      const hasDiscountRow = totalLabels.some(l => l.toLowerCase().includes('discount'));

      // Price displayed in the PDF table (4th column: UnitPrice)
      const priceCells = Array.from(modal.querySelectorAll('.quotation-table tbody tr td:nth-child(4)'));
      const displayedPrice = priceCells[0]?.textContent?.trim() || '';

      // Check branding elements
      const logoImg = modal.querySelector('.quotation-header-logo-img');
      const sigImg = modal.querySelector('.quotation-sig-img');
      const sealImg = modal.querySelector('.quotation-seal-img');
      const isoText = modal.querySelector('.quotation-company-iso')?.textContent?.trim() || '';

      return {
        ths,
        hasDiscountHeader,
        totalLabels,
        hasDiscountRow,
        displayedPrice,
        hasLogo: Boolean(logoImg && logoImg.src),
        hasSig: Boolean(sigImg && sigImg.src),
        hasSeal: Boolean(sealImg && sealImg.src),
        isoText
      };
    });

    testResults.test9_pdfHidesDiscountColumnAndDiscountRow = (!pdfDetails.hasDiscountHeader && !pdfDetails.hasDiscountRow && pdfDetails.ths.length === 7);
    testResults.test10_pdfShowsNetEffectiveUnitPriceAndTotals = (pdfDetails.displayedPrice.includes('4,680') || pdfDetails.displayedPrice.includes('4680'));
    testResults.test11_pdfRendersBrandingCompanyIsoAndSeal = (Boolean(pdfDetails.isoText) && Boolean(pdfDetails.displayedPrice) && pdfDetails.hasLogo && pdfDetails.hasSig && pdfDetails.hasSeal);

    console.log('✓ TEST 9 - PDF strictly hides discount column & discount row:', testResults.test9_pdfHidesDiscountColumnAndDiscountRow, pdfDetails);
    console.log('✓ TEST 10 - PDF shows net effective unit price (₹4,680):', testResults.test10_pdfShowsNetEffectiveUnitPriceAndTotals, pdfDetails.displayedPrice);
    console.log('✓ TEST 11 - PDF renders central company branding (logo, signature, seal, ISO):', testResults.test11_pdfRendersBrandingCompanyIsoAndSeal, {
      hasLogo: pdfDetails.hasLogo,
      hasSig: pdfDetails.hasSig,
      hasSeal: pdfDetails.hasSeal,
      isoText: pdfDetails.isoText
    });

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'verify_quotation_workflow_master_results.json'),
      JSON.stringify(testResults, null, 2)
    );
    console.log('\n--- FINAL VERIFICATION SUMMARY ---');
    console.log(JSON.stringify(testResults, null, 2));

  } catch (err) {
    console.error('Error during test execution:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_quotation_error.png'), fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
