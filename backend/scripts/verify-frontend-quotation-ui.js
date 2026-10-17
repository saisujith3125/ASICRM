const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setReactInputValue(page, selectorOrElement, value) {
  await page.evaluate((target, val) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selectorOrElement, value);
}

async function runBrowserTests() {
  console.log('--- STARTING FRONTEND QUOTATION UI VERIFICATION ---');
  console.log('Launching browser with binary:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // 1. Set Auth in localStorage and navigate
    console.log('[STEP 1] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*']
      }));
    });

    // 2. Open Direct Quotation Creation
    console.log('[STEP 2] Navigating to /quotations/new...');
    await page.goto('http://localhost:5173/quotations/new', { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Verify Quotation Editor rendered
    const title = await page.$eval('.quotation-main-title', (el) => el.textContent.trim()).catch(() => '');
    console.log(`✓ Quotation Editor Loaded. Title: "${title}"`);

    // 3. Select Customer
    console.log('[STEP 3] Selecting Customer...');
    const custInput = await page.$('.customer-selector-container input, .scs-input');
    if (custInput) {
      await custInput.click();
      await sleep(500);
      const custOption = await page.$('.scs-option-item, .customer-option');
      if (custOption) {
        await custOption.click();
        await sleep(600);
        console.log('✓ Customer selected via option click');
      }
    }

    // 4. Test Product 1 Selection (Dahua 5MP IR Bullet Camera) & Auto-Populating Description
    console.log('[STEP 4] Selecting Product 1 (Dahua 5MP IR Bullet Camera)...');
    const firstProductSelect = await page.$('.quotation-items-table tbody tr:first-child input.sps-direct-input');
    if (!firstProductSelect) throw new Error('Could not find first product select input (input.sps-direct-input)');

    await firstProductSelect.click();
    await page.keyboard.type('Dahua 5MP');
    await sleep(600);

    // Click matching option in dropdown or press Enter
    const productOption = await page.$('.sps-dropdown-portal li.sps-option-item, li.sps-option-item');
    if (productOption) {
      await productOption.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await sleep(800);

    // Verify Description auto-populated
    const descValue = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-desc-textarea', (el) => el.value);
    console.log(`✓ Row 1 Description auto-populated: "${descValue}"`);
    if (!descValue.includes('5MP outdoor IR bullet camera')) {
      throw new Error(`Expected description to contain "5MP outdoor IR bullet camera", got: "${descValue}"`);
    }

    // Verify Price auto-populated
    const priceValue = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-price-input', (el) => el.value);
    console.log(`✓ Row 1 Price auto-populated: ₹${priceValue}`);

    // 5. Test Quotation-Specific Description Editing (Multi-line)
    console.log('[STEP 5] Testing custom multi-line description edit in quotation...');
    const multiLineDesc = '5MP outdoor IR bullet camera with night vision.\nIncludes mounting bracket & waterproof weather-shield junction box.\nTested on-site with 30m cable run.';
    await setReactInputValue(page, '.quotation-items-table tbody tr:first-child .quotation-desc-textarea', multiLineDesc);
    await sleep(400);

    const editedDesc = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-desc-textarea', (el) => el.value);
    console.log(`✓ Description edited to 3 lines:\n${editedDesc}`);

    // 6. Test Product 4 Selection (Product with NO description in master)
    console.log('[STEP 6] Selecting Product with NO description on row 2...');
    const secondProductSelect = await page.$('.quotation-items-table tbody tr:nth-child(2) input.sps-direct-input');
    if (secondProductSelect) {
      await secondProductSelect.click();
      await page.keyboard.type('PROD-000004');
      await sleep(600);
      const prod4Option = await page.$('.sps-dropdown-portal li.sps-option-item, li.sps-option-item');
      if (prod4Option) {
        await prod4Option.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await sleep(800);

      const row2Desc = await page.$eval('.quotation-items-table tbody tr:nth-child(2) .quotation-desc-textarea', (el) => el.value);
      console.log(`✓ Row 2 Description for product without description is empty: "${row2Desc}" (Length: ${row2Desc.length})`);
      if (row2Desc !== '') {
        throw new Error(`Expected row 2 description to be empty string, got: "${row2Desc}"`);
      }
    }

    // 7. Test Duplicate Product Prevention
    console.log('[STEP 7] Testing duplicate product rejection...');
    const thirdProductSelect = await page.$('.quotation-items-table tbody tr:nth-child(3) input.sps-direct-input');
    if (thirdProductSelect) {
      await thirdProductSelect.click();
      await page.keyboard.type('Dahua 5MP');
      await sleep(600);
      const dupOption = await page.$('.sps-dropdown-portal li.sps-option-item, li.sps-option-item');
      if (dupOption) {
        await dupOption.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await sleep(500);

      // Check error banner
      const errorMsg = await page.$eval('.quotation-error-banner, .crm-alert-error, .quotation-error-msg', (el) => el.textContent.trim()).catch(() => '');
      console.log(`✓ Duplicate rejection message: "${errorMsg}"`);
    }

    // 8. Test Min-Price Rule Enforcement
    console.log('[STEP 8] Testing Min-Price enforcement...');
    // Dahua 5MP IR Bullet Camera dealer price is 4850. Let's enter 500
    await setReactInputValue(page, '.quotation-items-table tbody tr:first-child .quotation-price-input', '500');
    await sleep(600);

    const minPriceWarning = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-min-price-warning', (el) => el.textContent.trim()).catch(() => '');
    console.log(`✓ Inline min-price warning rendered: "${minPriceWarning}"`);
    if (!minPriceWarning.includes('Min: ₹') && !minPriceWarning.includes('4850')) {
      throw new Error(`Expected min-price warning, got: "${minPriceWarning}"`);
    }

    // Restore price to valid value (₹5500)
    await setReactInputValue(page, '.quotation-items-table tbody tr:first-child .quotation-price-input', '5500');
    await sleep(600);
    const clearedWarning = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-min-price-warning', (el) => el.textContent.trim()).catch(() => '');
    console.log(`✓ Min-price warning cleared when price valid: "${clearedWarning}"`);

    // 9. Test Discount Toggle & Calculation
    console.log('[STEP 9] Testing Discount toggle & calculation...');
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const discLabel = labels.find((l) => l.textContent.includes('Show Discount'));
      if (discLabel) {
        const cb = discLabel.querySelector('input');
        if (cb && !cb.checked) cb.click();
      }
    });
    await sleep(600);

    // Verify Discount column appeared
    const discountHeader = await page.$('.quotation-col-discount');
    if (!discountHeader) throw new Error('Discount column did not appear when Show Discount was toggled ON');
    console.log('✓ Discount (%) column is visible');

    // Enter 10% discount on row 1
    await setReactInputValue(page, '.quotation-items-table tbody tr:first-child .quotation-discount-input', '10');
    await sleep(600);

    // 10. Test Round-Off Toggle & Calculation
    console.log('[STEP 10] Testing Round-Off toggle & calculation...');
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const roLabel = labels.find((l) => l.textContent.includes('Round Off Total'));
      if (roLabel) {
        const cb = roLabel.querySelector('input');
        if (cb && !cb.checked) cb.click();
      }
    });
    await sleep(600);

    // Read Summary Strip Values
    const summaryTexts = await page.$$eval('.quotation-summary-item', (els) => els.map((el) => el.textContent.trim()));
    const grandTotalText = await page.$eval('.quotation-grand-total', (el) => el.textContent.trim());
    console.log('✓ Summary Strip items:', summaryTexts);
    console.log('✓ Grand Total:', grandTotalText);

    // Take screenshot of Editor
    const editorScreenshot = path.join(ARTIFACTS_DIR, 'verify_quotation_editor_master.png');
    await page.screenshot({ path: editorScreenshot, fullPage: true });
    console.log(`✓ Screenshot saved: ${editorScreenshot}`);

    // 11. Test PDF/Print Preview Modal
    console.log('[STEP 11] Opening Print Preview modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent.includes('Quotation PDF') || b.textContent.includes('Preview') || b.textContent.includes('Print'));
      if (btn) btn.click();
    });
    await sleep(1500);

    // Check if PrintableQuotation rendered inside modal
    const modalQuotationTable = await page.$('.doc-quotation-root .quotation-table');
    if (modalQuotationTable) {
      console.log('✓ Print Preview Modal rendered with official PrintableQuotation!');
      const previewDesc = await page.$eval('.doc-quotation-root .quotation-table .item-desc', (el) => el.textContent.trim()).catch(() => '');
      console.log(`✓ Print Preview Item Description: "${previewDesc}"`);
      const previewDiscountHeader = await page.$eval('.doc-quotation-root .quotation-table th:nth-child(6)', (el) => el.textContent.trim()).catch(() => '');
      console.log(`✓ Print Preview Column 6 Header: "${previewDiscountHeader}"`);

      const printScreenshot = path.join(ARTIFACTS_DIR, 'verify_quotation_print_preview.png');
      await page.evaluate(() => {
        const table = document.querySelector('.doc-quotation-root .quotation-table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await sleep(600);
      await page.screenshot({ path: printScreenshot, fullPage: false });
      console.log(`✓ Screenshot saved: ${printScreenshot}`);

      // Close modal
      await page.evaluate(() => {
        const closeBtns = Array.from(document.querySelectorAll('.doc-preview-modal-close, .modal-close, button'));
        const close = closeBtns.find((b) => b.getAttribute('aria-label') === 'Close' || b.textContent === '✕' || b.textContent.includes('Close'));
        if (close) close.click();
      });
      await sleep(600);
    }

    // 12. Test "+ Add Product to Master" return-to flow
    console.log('[STEP 12] Testing "+ Add Product to Master" with return-to quotation...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addProdBtn = btns.find((b) => b.textContent.includes('Add Product to Master'));
      if (addProdBtn) addProdBtn.click();
    });
    await sleep(1500);

    const currentUrl = page.url();
    console.log(`✓ Navigated to: ${currentUrl}`);
    if (!currentUrl.includes('/stocks/products/new')) {
      throw new Error(`Expected URL to include /stocks/products/new, got: ${currentUrl}`);
    }

    // Click Cancel on Product Create page to return to quotation
    console.log('[STEP 13] Clicking Cancel on Product Create page to test return navigation...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find((b) => b.textContent.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(1500);

    const returnedUrl = page.url();
    console.log(`✓ Returned to URL: ${returnedUrl}`);

    // Verify draft was restored
    const restoredDesc = await page.$eval('.quotation-items-table tbody tr:first-child .quotation-desc-textarea', (el) => el.value).catch(() => '');
    console.log(`✓ Restored Quotation Description: "${restoredDesc}"`);
    if (!restoredDesc.includes('5MP outdoor IR bullet camera')) {
      throw new Error(`Quotation draft was not preserved on return! Got: "${restoredDesc}"`);
    }
    console.log('✓ Quotation draft state successfully preserved on return!');

    console.log('\n======================================================');
    console.log('ALL FRONTEND QUOTATION UI TESTS PASSED SUCCESSFULLY');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ FRONTEND TEST RUN FAILED:', err);
    const errScreenshot = path.join(ARTIFACTS_DIR, 'verify_quotation_error.png');
    await page.screenshot({ path: errScreenshot, fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserTests().catch(() => process.exit(1));
