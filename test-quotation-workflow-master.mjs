import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/pc/.gemini/antigravity/brain/a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function run() {
  console.log('--- STARTING COMPREHENSIVE QUOTATION WORKFLOW MASTER TEST ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        role: 'Super Admin',
        email: 'admin@asi.ind.in',
        phone: '9840012345'
      }));
    });

    // 1. Navigate to /quotations/new
    console.log('Navigating to /quotations/new...');
    await page.goto('http://localhost:5173/quotations/new', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

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

    // TEST 2: Customer with 0 branches (CUST-001 Aarav Sharma)
    console.log('Selecting Customer with 0 branches (Aarav Sharma)...');
    // Type in customer selector input
    const customerInput = await page.$('.sps-direct-input');
    if (!customerInput) throw new Error('Customer direct input not found');
    await customerInput.click();
    await customerInput.type('Aarav Sharma');
    await new Promise(r => setTimeout(r, 600));

    // Click matching item in dropdown
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-option-item'));
      const match = items.find(el => el.textContent.includes('Aarav Sharma'));
      if (match) match.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Verify Branch Selector and Link Enquiry are HIDDEN for CUST-001
    const test2State = await page.evaluate(() => {
      const text = document.body.innerText;
      const selects = Array.from(document.querySelectorAll('select'));
      const hasBranchSelect = selects.some(s => s.previousElementSibling?.textContent?.includes('Branch') || s.innerText.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.previousElementSibling?.textContent?.includes('Link Enquiry') || s.innerText.includes('Standalone Quotation'));
      const hasCustomerSummary = text.includes('Aarav Sharma') && (text.includes('📞') || text.includes('✉️') || text.includes('📍'));
      return { hasBranchSelect, hasEnquirySelect, hasCustomerSummary };
    });
    testResults.test2_zeroBranchCustomerHidesBranchAndEnquiry = (!test2State.hasBranchSelect && !test2State.hasEnquirySelect && test2State.hasCustomerSummary);
    console.log('✓ TEST 2 - Customer with 0 branches hides branch selector & enquiry link:', testResults.test2_zeroBranchCustomerHidesBranchAndEnquiry, test2State);

    // TEST 3: Customer with multiple branches (CUST-002 Priya Patel)
    console.log('Selecting Customer with multiple branches (Priya Patel)...');
    const clearBtn = await page.$('.sps-clear-btn');
    if (clearBtn) await clearBtn.click();
    await new Promise(r => setTimeout(r, 300));

    await customerInput.click();
    await customerInput.type('Priya Patel');
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-option-item'));
      const match = items.find(el => el.textContent.includes('Priya Patel'));
      if (match) match.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Verify Branch Selector IS displayed, but Link Enquiry is NOT yet displayed before branch selection
    const test3State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const hasBranchSelect = selects.some(s => s.innerHTML.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return { hasBranchSelect, hasEnquirySelect };
    });
    testResults.test3_multiBranchCustomerShowsBranchSelector = (test3State.hasBranchSelect && !test3State.hasEnquirySelect);
    console.log('✓ TEST 3 - Multi-branch customer shows branch selector and waits for branch selection:', testResults.test3_multiBranchCustomerShowsBranchSelector, test3State);

    // TEST 4: Select a branch and verify Link Enquiry now appears
    console.log('Selecting a branch...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const branchSelect = selects.find(s => s.innerHTML.includes('Select Branch'));
      if (branchSelect && branchSelect.options.length > 1) {
        branchSelect.selectedIndex = 1;
        branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 600));

    const test4State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return hasEnquirySelect;
    });
    testResults.test4_branchSelectionEnablesEnquiryLink = test4State;
    console.log('✓ TEST 4 - Branch selection enables Link Enquiry control:', testResults.test4_branchSelectionEnablesEnquiryLink);

    // TEST 5: Changing customer resets previous branch and enquiry links
    console.log('Changing customer back to Aarav Sharma to verify reset...');
    const clearBtn2 = await page.$('.sps-clear-btn');
    if (clearBtn2) await clearBtn2.click();
    await new Promise(r => setTimeout(r, 300));

    await customerInput.click();
    await customerInput.type('Aarav Sharma');
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-option-item'));
      const match = items.find(el => el.textContent.includes('Aarav Sharma'));
      if (match) match.click();
    });
    await new Promise(r => setTimeout(r, 800));

    const test5State = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const hasBranchSelect = selects.some(s => s.innerHTML.includes('Select Branch'));
      const hasEnquirySelect = selects.some(s => s.innerHTML.includes('Standalone Quotation'));
      return !hasBranchSelect && !hasEnquirySelect;
    });
    testResults.test5_customerChangeResetsBranchAndEnquiry = test5State;
    console.log('✓ TEST 5 - Changing customer resets previous branch and enquiry links:', testResults.test5_customerChangeResetsBranchAndEnquiry);

    // Switch back to Priya Patel and select branch for complete quotation test
    const clearBtn3 = await page.$('.sps-clear-btn');
    if (clearBtn3) await clearBtn3.click();
    await customerInput.click();
    await customerInput.type('Priya Patel');
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-option-item'));
      const match = items.find(el => el.textContent.includes('Priya Patel'));
      if (match) match.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const branchSelect = selects.find(s => s.innerHTML.includes('Select Branch'));
      if (branchSelect && branchSelect.options.length > 1) {
        branchSelect.selectedIndex = 1;
        branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // TEST 6: Add Product and Duplicate Product Prevention
    console.log('Selecting Product PROD-000001 (Hikvision 2MP Bullet Camera) in row 1...');
    await page.evaluate(() => {
      const rowSelects = Array.from(document.querySelectorAll('.quotation-items-table .sps-input-trigger-wrapper'));
      if (rowSelects[0]) rowSelects[0].click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-portal-dropdown .sps-option-item'));
      const prodItem = items.find(el => el.textContent.includes('Hikvision 2MP Bullet Camera') || el.textContent.includes('CAM-IPC-001'));
      if (prodItem) prodItem.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Now try to select the same product in row 2
    console.log('Attempting to select same product in row 2 to verify duplicate block...');
    await page.evaluate(() => {
      const rowSelects = Array.from(document.querySelectorAll('.quotation-items-table .sps-input-trigger-wrapper'));
      if (rowSelects[1]) rowSelects[1].click();
    });
    await new Promise(r => setTimeout(r, 500));

    const duplicateAttemptResult = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sps-portal-dropdown .sps-option-item'));
      const prodItem = items.find(el => el.textContent.includes('Hikvision 2MP Bullet Camera') || el.textContent.includes('CAM-IPC-001'));
      if (prodItem) {
        const isDisabled = prodItem.classList.contains('is-disabled');
        prodItem.click();
        return { clicked: true, wasDisabled: isDisabled };
      }
      return { clicked: false, wasDisabled: false };
    });
    await new Promise(r => setTimeout(r, 800));

    const duplicateBannerText = await page.evaluate(() => {
      const errBox = document.querySelector('.crm-alert-box.error');
      return errBox ? errBox.innerText : '';
    });

    testResults.test6_duplicateProductBlocked = (duplicateAttemptResult.wasDisabled || duplicateBannerText.includes('already added'));
    console.log('✓ TEST 6 - Duplicate product prevented:', testResults.test6_duplicateProductBlocked, { duplicateBannerText, duplicateAttemptResult });

    // TEST 7: Price Validation below Configured Base Price
    console.log('Testing price validation below configured base price...');
    // Set price to 2000 (below minPrice 3200)
    await page.evaluate(() => {
      const priceInputs = Array.from(document.querySelectorAll('.quotation-price-input'));
      if (priceInputs[0]) {
        priceInputs[0].value = '2000';
        priceInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        priceInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Click Save & Issue Quotation
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => b.textContent.includes('Save & Issue') || b.textContent.includes('Save Quotation'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const priceValidationMsg = await page.evaluate(() => {
      const errBox = document.querySelector('.crm-alert-box.error');
      return errBox ? errBox.innerText : '';
    });
    testResults.test7_priceBelowMinPriceBlocked = priceValidationMsg.includes("Quotation price cannot be lower than the product's configured price");
    console.log('✓ TEST 7 - Price validation error message:', testResults.test7_priceBelowMinPriceBlocked, priceValidationMsg);

    // Correct price back to 3500
    await page.evaluate(() => {
      const priceInputs = Array.from(document.querySelectorAll('.quotation-price-input'));
      if (priceInputs[0]) {
        priceInputs[0].value = '3500';
        priceInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        priceInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // TEST 9 & 10: Toggle Discount and Round Off, then inspect PDF Preview
    console.log('Enabling Show Discount and Round Off Total in editor...');
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const discCb = checkboxes.find(c => c.nextElementSibling?.textContent?.includes('Show Discount'));
      const roundCb = checkboxes.find(c => c.nextElementSibling?.textContent?.includes('Round Off'));
      if (discCb && !discCb.checked) discCb.click();
      if (roundCb && !roundCb.checked) roundCb.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Set 10% discount on row 1 in editor
    await page.evaluate(() => {
      const discInput = document.querySelector('.quotation-discount-input');
      if (discInput) {
        discInput.value = '10';
        discInput.dispatchEvent(new Event('input', { bubbles: true }));
        discInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // Take editor screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_quotation_editor_master.png'), fullPage: true });

    // Open PDF Preview Modal
    console.log('Opening PDF Preview modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const previewBtn = buttons.find(b => b.textContent.includes('Preview / Print PDF') || b.textContent.includes('Print') || b.textContent.includes('Preview'));
      if (previewBtn) previewBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

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

      // Price displayed in the PDF table
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
    testResults.test10_pdfShowsNetEffectiveUnitPriceAndTotals = (pdfDetails.displayedPrice.includes('3,150') || pdfDetails.displayedPrice.includes('3150'));
    testResults.test11_pdfRendersBrandingCompanyIsoAndSeal = (pdfDetails.hasLogo && pdfDetails.hasSig && pdfDetails.hasSeal && Boolean(pdfDetails.isoText));

    console.log('✓ TEST 9 - PDF strictly hides discount column & discount row:', testResults.test9_pdfHidesDiscountColumnAndDiscountRow, pdfDetails);
    console.log('✓ TEST 10 - PDF shows net effective unit price (₹3,150):', testResults.test10_pdfShowsNetEffectiveUnitPriceAndTotals, pdfDetails.displayedPrice);
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
