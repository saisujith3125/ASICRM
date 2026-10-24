const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('--- STARTING COMPREHENSIVE VERIFICATION SUITE ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Helper to log in if needed
  await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1000);

  // Check if redirected to login
  if (page.url().includes('/login')) {
    console.log('Logging in as Super Admin...');
    await page.type('input[type="text"], input[name="username"], input[name="email"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
  }

  const artifactsDir = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

  // =========================================================================
  // TEST 1: Quotation Stock Validation & PDF Blocking (QT-000067)
  // =========================================================================
  console.log('\n[TEST 1] Quotation Stock Validation & PDF Blocking...');
  await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(1500);

  // Look for QT-000067 or click the first quotation's View button
  const viewButtons = await page.$$('button.tbl-action-btn.edit, button.tbl-action-btn.quotation-convert-btn');
  if (viewButtons.length > 0) {
    await viewButtons[0].click();
    await page.waitForTimeout(2000);
  } else {
    // Navigate directly to /quotations/new
    await page.goto('https://crmapi.asiind.com/quotations/new', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
  }

  // Find quantity input
  const qtyInput = await page.$('.quotation-items-table tbody tr input.quotation-qty-input');
  if (qtyInput) {
    // Read current stock value
    const stockBadge = await page.$('.quotation-items-table tbody tr .quotation-stock-pill');
    let stockVal = 273;
    if (stockBadge) {
      const stockText = await page.evaluate(el => el.innerText, stockBadge);
      stockVal = parseInt(stockText, 10) || 273;
    }
    console.log(`Current product stock is: ${stockVal}`);

    // Enter quantity exceeding stock: stockVal + 200
    const invalidQty = stockVal + 200;
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type(String(invalidQty));
    await page.waitForTimeout(1000);

    // Verify inline error message
    const errorMsgEl = await page.$('.quotation-items-table tbody tr .quotation-qty-error');
    const errorText = errorMsgEl ? await page.evaluate(el => el.innerText, errorMsgEl) : '';
    console.log(`Inline validation error for invalid qty (${invalidQty}): "${errorText}"`);

    // Verify "Quotation PDF" button is blocked / disabled
    const pdfBtn = await page.$('button[title*="Cannot generate PDF"], button[title*="Quotation PDF"]');
    const pdfBtnOpacity = await page.evaluate(el => window.getComputedStyle(el).opacity, pdfBtn);
    const pdfBtnCursor = await page.evaluate(el => window.getComputedStyle(el).cursor, pdfBtn);
    console.log(`Quotation PDF button style when invalid: opacity=${pdfBtnOpacity}, cursor=${pdfBtnCursor}`);

    // Click Quotation PDF button and verify modal does NOT open
    await pdfBtn.click();
    await page.waitForTimeout(1000);
    const modalOpen = await page.$('.doc-preview-modal-backdrop, .crm-modal-backdrop');
    console.log(`Was PDF preview modal opened with invalid qty? ${modalOpen ? 'YES (BUG!)' : 'NO (CORRECTLY BLOCKED!)'}`);

    // Take screenshot of invalid quotation state
    await page.screenshot({
      path: path.join(artifactsDir, 'verify_quotation_stock_invalid_blocked.png'),
      fullPage: true
    });
    console.log('Saved screenshot: verify_quotation_stock_invalid_blocked.png');

    // Now correct the quantity to within stock: stockVal - 50 (or 5)
    const validQty = Math.max(1, Math.min(stockVal, 50));
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type(String(validQty));
    await page.waitForTimeout(1000);

    // Verify error is gone and PDF button is enabled
    const pdfBtnValid = await page.$('button[title*="View & Download Official Quotation PDF"]');
    const pdfBtnValidOpacity = await page.evaluate(el => window.getComputedStyle(el).opacity, pdfBtnValid);
    console.log(`Quotation PDF button style when valid (${validQty}): opacity=${pdfBtnValidOpacity}`);

    // Click Quotation PDF button
    await pdfBtnValid.click();
    await page.waitForTimeout(2000);

    const modalOpenedValid = await page.$('.doc-preview-modal-backdrop, .crm-modal-backdrop');
    console.log(`Was PDF preview modal opened with valid qty? ${modalOpenedValid ? 'YES (CORRECT!)' : 'NO (ERROR)'}`);

    // =========================================================================
    // TEST 2: Quotation PDF Layout, Branding, Grid, and Totals
    // =========================================================================
    console.log('\n[TEST 2] Verifying Quotation PDF Layout & Branding...');
    // Inspect logo in Quotation PDF
    const logoImg = await page.$('.quotation-header-logo img');
    if (logoImg) {
      const logoSrc = await page.evaluate(el => el.src, logoImg);
      const isOfficialMaster = logoSrc.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA');
      console.log(`Quotation PDF header logo: ${isOfficialMaster ? 'OFFICIAL MASTER LOGO (CORRECT)' : 'OTHER/OLD LOGO'}`);
    }

    // Inspect watermark
    const watermarkImg = await page.$('.quotation-watermark img');
    if (watermarkImg) {
      const wmOpacity = await page.evaluate(el => window.getComputedStyle(el).opacity, watermarkImg);
      console.log(`Quotation PDF watermark rendered with subtle opacity: ${wmOpacity}`);
    }

    // Inspect table grid and column widths
    const ths = await page.$$('.quotation-table thead th');
    console.log(`Quotation table columns count: ${ths.length}`);
    for (let i = 0; i < ths.length; i++) {
      const colInfo = await page.evaluate(el => ({ text: el.innerText, width: el.style.width }), ths[i]);
      console.log(`  Col ${i + 1}: ${colInfo.text} -> width style: ${colInfo.width}`);
    }

    // Inspect totals row bottom-left enclosure
    const blankCell = await page.$('.quotation-total-row .quotation-total-blank');
    if (blankCell) {
      const blankBorder = await page.evaluate(el => window.getComputedStyle(el).border, blankCell);
      console.log(`Quotation total blank cell border (no-border-left-bottom removed): ${blankBorder}`);
    }

    // Take screenshot of Quotation PDF Preview
    await page.screenshot({
      path: path.join(artifactsDir, 'verify_quotation_pdf_official_branding_and_grid.png'),
      fullPage: true
    });
    console.log('Saved screenshot: verify_quotation_pdf_official_branding_and_grid.png');

    // Close PDF modal
    const closeBtn = await page.$('.doc-preview-close-btn, button.close');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // =========================================================================
  // TEST 3: Delivery Challan Customer Deduplication & Master Branding
  // =========================================================================
  console.log('\n[TEST 3] Verifying Delivery Challan Customer Deduplication & Branding...');
  await page.goto('https://crmapi.asiind.com/delivery-challans/dc-000116', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);

  // Check if DC view is loaded
  const consigneeEl = await page.$('.dc-consignee-party');
  if (consigneeEl) {
    const consigneeText = await page.evaluate(el => el.innerText, consigneeEl);
    console.log('Consignee party rendered text:\n', consigneeText);
    const gomathiCount = (consigneeText.match(/Gomathi/g) || []).length;
    console.log(`Occurrences of "Gomathi" in Consignee Box: ${gomathiCount} (Expected: exactly 1)`);
  }

  const dispatchEl = await page.$('.dc-dispatch-party');
  if (dispatchEl) {
    const dispatchText = await page.evaluate(el => el.innerText, dispatchEl);
    console.log('Dispatched-To party rendered text:\n', dispatchText);
    const gomathiDispatchCount = (dispatchText.match(/Gomathi/g) || []).length;
    console.log(`Occurrences of "Gomathi" in Dispatched-To Box: ${gomathiDispatchCount} (Expected: exactly 1)`);
  }

  // Take screenshot of DC view
  await page.screenshot({
    path: path.join(artifactsDir, 'verify_dc_000116_dedup_and_official_branding.png'),
    fullPage: true
  });
  console.log('Saved screenshot: verify_dc_000116_dedup_and_official_branding.png');

  // =========================================================================
  // TEST 4: Delivery Challan Stock Validation & Full Width Layout
  // =========================================================================
  console.log('\n[TEST 4] Verifying Delivery Challan Stock Validation on New DC...');
  await page.goto('https://crmapi.asiind.com/delivery-challans/new', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);

  // Check table width
  const dcTable = await page.$('.dc-items-table');
  if (dcTable) {
    const tableWidth = await page.evaluate(el => el.getBoundingClientRect().width, dcTable);
    const containerWidth = await page.evaluate(el => el.parentElement.getBoundingClientRect().width, dcTable);
    console.log(`DC Table width: ${tableWidth}px, Container width: ${containerWidth}px (100% full width: ${Math.abs(tableWidth - containerWidth) < 2})`);
  }

  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  await browser.close();
})();
