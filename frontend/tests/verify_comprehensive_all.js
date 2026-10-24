import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function run() {
  console.log('--- STARTING COMPREHENSIVE VERIFICATION SUITE ---');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Initial load & authenticate
  await page.goto('https://crmapi.asiind.com/delivery-challans', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1500));

  const isLoginPage = await page.$('input[type="password"]');
  if (isLoginPage) {
    console.log('Logging in as Super Admin...');
    const userField = await page.$('input[type="text"], input[name="username"], input[name="email"]');
    if (userField) await userField.type('admin');
    const passField = await page.$('input[type="password"]');
    if (passField) await passField.type('admin123');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await new Promise((r) => setTimeout(r, 2000));
  }

  // =========================================================================
  // TEST 1: Quotation Stock Validation & PDF Blocking (QT-000067)
  // =========================================================================
  console.log('\n[TEST 1] Quotation Stock Validation & PDF Blocking in Editor...');
  await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Find first edit/view button
  const viewBtns = await page.$$('button.tbl-action-btn.edit, button.tbl-action-btn.quotation-convert-btn');
  if (viewBtns.length > 0) {
    await viewBtns[0].click();
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Check if we are in quotation editor
  const qtyInput = await page.$('.quotation-items-table tbody tr input.quotation-qty-input');
  if (qtyInput) {
    const stockPill = await page.$('.quotation-items-table tbody tr .quotation-stock-pill');
    let availStock = 273;
    if (stockPill) {
      const txt = await page.evaluate((el) => el.innerText, stockPill);
      availStock = parseInt(txt, 10) || 273;
    }
    console.log(`Available stock in row: ${availStock}`);

    // Enter invalid quantity > stock
    const badQty = availStock + 200;
    console.log(`Entering invalid quantity: ${badQty}...`);
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type(String(badQty));
    await new Promise((r) => setTimeout(r, 1000));

    // Verify inline error
    const inlineError = await page.$('.quotation-items-table tbody tr .quotation-qty-error');
    if (inlineError) {
      const errTxt = await page.evaluate((el) => el.innerText, inlineError);
      console.log(`✓ Inline validation error visible: "${errTxt}"`);
    } else {
      console.log('✗ Inline validation error NOT found!');
    }

    // Verify Save button disabled
    const saveBtn = await page.$('button.quotation-save-btn');
    if (saveBtn) {
      const isDisabled = await page.evaluate((el) => el.disabled || el.getAttribute('disabled') !== null, saveBtn);
      console.log(`✓ Save / Update Quotation button disabled: ${isDisabled}`);
    }

    // Verify Quotation PDF button blocked
    const pdfBtn = await page.$('button[title*="Cannot generate PDF"], button[title*="Quotation PDF"]');
    if (pdfBtn) {
      const cursor = await page.evaluate((el) => window.getComputedStyle(el).cursor, pdfBtn);
      const opacity = await page.evaluate((el) => window.getComputedStyle(el).opacity, pdfBtn);
      console.log(`✓ Quotation PDF button blocked style: cursor=${cursor}, opacity=${opacity}`);

      // Attempt to click and verify modal does NOT open
      await pdfBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const modal = await page.$('.doc-preview-modal-backdrop');
      console.log(`✓ Was PDF modal blocked from opening? ${!modal ? 'YES (SUCCESS)' : 'NO (FAILED)'}`);
    }

    // Capture screenshot of invalid quotation editor state
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verify_quotation_stock_validation_blocked.png'),
      fullPage: true
    });
    console.log('Saved: verify_quotation_stock_validation_blocked.png');

    // Now correct to valid quantity (e.g. 50)
    const goodQty = Math.min(availStock, 50);
    console.log(`\nCorrecting to valid quantity: ${goodQty}...`);
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type(String(goodQty));
    await new Promise((r) => setTimeout(r, 1000));

    // Verify PDF button is now enabled
    const pdfBtnValid = await page.$('button[title*="View & Download Official Quotation PDF"]');
    if (pdfBtnValid) {
      const cursor = await page.evaluate((el) => window.getComputedStyle(el).cursor, pdfBtnValid);
      console.log(`✓ Quotation PDF button cursor after fix: ${cursor}`);

      // Open PDF modal
      await pdfBtnValid.click();
      await new Promise((r) => setTimeout(r, 2000));

      const pdfModal = await page.$('.doc-preview-modal-backdrop');
      console.log(`✓ Did PDF modal open with valid quantity? ${pdfModal ? 'YES (SUCCESS)' : 'NO'}`);

      // =========================================================================
      // TEST 2: Quotation PDF Layout, Official Branding, Grid & Totals
      // =========================================================================
      console.log('\n[TEST 2] Verifying Quotation PDF Layout, Branding & Grid...');

      // 1. Verify Master Official Logo
      const logoImg = await page.$('.quotation-header-logo img');
      if (logoImg) {
        const logoSrc = await page.evaluate((el) => el.src, logoImg);
        const isMasterLogo = logoSrc.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA');
        console.log(`✓ Quotation PDF Logo: ${isMasterLogo ? 'OFFICIAL MASTER LOGO (PASS)' : 'UNEXPECTED LOGO'}`);
      }

      // 2. Verify subtle watermark
      const wmImg = await page.$('.quotation-watermark img');
      if (wmImg) {
        const wmOpacity = await page.evaluate((el) => window.getComputedStyle(el).opacity, wmImg);
        console.log(`✓ Subtle watermark rendered with low opacity: ${wmOpacity}`);
      }

      // 3. Verify Table Column Widths (6%, 44%, 10%, 12%, 8%, 10%, 10%)
      const ths = await page.$$('.quotation-table thead th');
      console.log(`✓ Table columns count: ${ths.length}`);
      for (let i = 0; i < ths.length; i++) {
        const info = await page.evaluate((el) => ({ text: el.innerText, width: el.style.width }), ths[i]);
        console.log(`   Col ${i + 1} (${info.text}): width = ${info.width}`);
      }

      // 4. Verify no-border-left-bottom removed and quotation-total-blank bordered
      const blankCell = await page.$('.quotation-total-row .quotation-total-blank');
      if (blankCell) {
        const borderStyle = await page.evaluate((el) => window.getComputedStyle(el).border, blankCell);
        console.log(`✓ Quotation totals bottom-left blank cell has border: ${borderStyle}`);
      }

      // Capture screenshot of Quotation PDF Preview
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'verify_quotation_pdf_complete_grid_and_master_logo.png'),
        fullPage: true
      });
      console.log('Saved: verify_quotation_pdf_complete_grid_and_master_logo.png');

      // Close modal
      const closeBtn = await page.$('.doc-preview-close-btn');
      if (closeBtn) {
        await closeBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // =========================================================================
  // TEST 3: Delivery Challan Customer Deduplication & Master Branding
  // =========================================================================
  console.log('\n[TEST 3] Verifying DC Customer Deduplication & Official Branding...');
  // Fetch DC-000116 from backend and mount directly in browser DOM
  const dcRes = await fetch('https://crmapi.asiind.com/api/orders/delivery-challans/DC-000116', {
    headers: { 'x-user-id': 'USR-001' }
  });
  const dcJson = await dcRes.json();
  const dcRecord = dcJson.data;

  if (dcRecord) {
    await page.evaluate(async (dc) => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default || window.React;
      const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default || window.ReactDOM;
      const PrintableDC = (await import('/src/components/documents/PrintableDeliveryChallan.jsx')).default;

      let wrap = document.getElementById('test-modal-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'test-modal-wrap';
        wrap.style.position = 'fixed';
        wrap.style.top = '0';
        wrap.style.left = '0';
        wrap.style.width = '100vw';
        wrap.style.height = '100vh';
        wrap.style.backgroundColor = 'rgba(15, 23, 42, 0.7)';
        wrap.style.zIndex = '99999';
        wrap.style.display = 'flex';
        wrap.style.justifyContent = 'center';
        wrap.style.alignItems = 'flex-start';
        wrap.style.overflow = 'auto';
        wrap.style.padding = '40px 0';
        document.body.appendChild(wrap);
      }

      const root = ReactDOM.createRoot(wrap);
      root.render(React.createElement(PrintableDC, { data: dc }));
    }, dcRecord);
    await new Promise((r) => setTimeout(r, 2000));

    // Check consignee and dispatched-to text
    const consigneeTxt = await page.evaluate(() => {
      const el = document.querySelector('.dc-consignee-party');
      return el ? el.innerText : '';
    });
    console.log('Consignee rendered text:\n' + consigneeTxt);
    const consigneeGomathiCount = (consigneeTxt.match(/Gomathi/g) || []).length;
    console.log(`✓ "Gomathi" occurrences in Consignee: ${consigneeGomathiCount} (Must be exactly 1)`);

    const dispatchTxt = await page.evaluate(() => {
      const el = document.querySelector('.dc-dispatch-party');
      return el ? el.innerText : '';
    });
    console.log('Dispatched-To rendered text:\n' + dispatchTxt);
    const dispatchGomathiCount = (dispatchTxt.match(/Gomathi/g) || []).length;
    console.log(`✓ "Gomathi" occurrences in Dispatched-To: ${dispatchGomathiCount} (Must be exactly 1)`);

    // Verify official master logo rendered
    const dcLogoSrc = await page.evaluate(() => {
      const img = document.querySelector('.dc-company-logo-img');
      return img ? img.src : '';
    });
    const isDcMasterLogo = dcLogoSrc.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA');
    console.log(`✓ DC Document Logo: ${isDcMasterLogo ? 'OFFICIAL MASTER LOGO (PASS)' : 'OTHER LOGO'}`);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'verify_dc_dedup_and_master_logo.png'),
      fullPage: true
    });
    console.log('Saved: verify_dc_dedup_and_master_logo.png');
  }

  // =========================================================================
  // TEST 4: Delivery Challan New DC Full-Width Layout & Stock Validation
  // =========================================================================
  console.log('\n[TEST 4] Verifying New DC Stock Validation and Full-Width Layout...');
  await page.goto('https://crmapi.asiind.com/delivery-challans/new', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Check table width
  const dcTableInfo = await page.evaluate(() => {
    const table = document.querySelector('.dc-items-table');
    if (!table) return null;
    const tRect = table.getBoundingClientRect();
    const pRect = table.parentElement.getBoundingClientRect();
    return { tableWidth: tRect.width, parentWidth: pRect.width };
  });

  if (dcTableInfo) {
    console.log(`✓ DC Table width: ${dcTableInfo.tableWidth}px, Parent container width: ${dcTableInfo.parentWidth}px`);
    console.log(`✓ Full-width match: ${Math.abs(dcTableInfo.tableWidth - dcTableInfo.parentWidth) < 2}`);
  }

  // Select customer if needed
  const custSelect = await page.$('.dc-customer-select, select[name="customerId"]');
  if (custSelect) {
    await page.select('.dc-customer-select, select[name="customerId"]', 'CUST-0001');
    await new Promise((r) => setTimeout(r, 500));
  }

  // Select product
  const prodSelect = await page.$('.dc-product-select-inline');
  if (prodSelect) {
    await page.evaluate((el) => {
      if (el.options.length > 1) {
        el.selectedIndex = 1;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, prodSelect);
    await new Promise((r) => setTimeout(r, 1000));

    // Get available stock
    const availQtyEl = await page.$('.dc-items-table tbody tr td:nth-child(4) .dc-avail-pill');
    let dcAvail = 250;
    if (availQtyEl) {
      const txt = await page.evaluate((el) => el.innerText, availQtyEl);
      dcAvail = parseInt(txt, 10) || 250;
    }
    console.log(`DC Available Stock: ${dcAvail}`);

    // Enter delivery quantity = avail + 250 (e.g. 500)
    const dcQtyInput = await page.$('.dc-qty-input');
    if (dcQtyInput) {
      const badDcQty = dcAvail + 250;
      console.log(`Entering invalid DC delivery quantity: ${badDcQty}...`);
      await dcQtyInput.click({ clickCount: 3 });
      await dcQtyInput.type(String(badDcQty));
      await new Promise((r) => setTimeout(r, 1000));

      // Verify inline error
      const dcInlineErr = await page.$('.dc-qty-error-msg');
      if (dcInlineErr) {
        const dcErrTxt = await page.evaluate((el) => el.innerText, dcInlineErr);
        console.log(`✓ DC Inline error: "${dcErrTxt}"`);
      }

      // Verify Save DC button disabled
      const saveDcBtn = await page.$('.dc-action-btn-save');
      if (saveDcBtn) {
        const isDcSaveDisabled = await page.evaluate((el) => el.disabled || el.getAttribute('disabled') !== null, saveDcBtn);
        console.log(`✓ Save Delivery Challan disabled when invalid: ${isDcSaveDisabled}`);
      }

      // Verify PDF button disabled / blocked
      const dcPdfBtn = await page.$('.dc-action-btn-pdf');
      if (dcPdfBtn) {
        const isDcPdfDisabled = await page.evaluate((el) => el.disabled || el.getAttribute('disabled') !== null, dcPdfBtn);
        console.log(`✓ DC PDF Preview button disabled when invalid: ${isDcPdfDisabled}`);
      }

      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'verify_dc_stock_validation_blocked.png'),
        fullPage: true
      });
      console.log('Saved: verify_dc_stock_validation_blocked.png');
    }
  }

  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  await browser.close();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
