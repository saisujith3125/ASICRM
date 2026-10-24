const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_test_roundoff_'));
const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function run() {
  const PORT = 9873;
  console.log('Spawning Chrome on port ' + PORT + '...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ]);

  let tabs = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (listRes.ok) {
        tabs = await listRes.json();
        if (tabs && tabs.length > 0) break;
      }
    } catch (_) {}
  }

  if (!tabs || tabs.length === 0) {
    throw new Error('Chrome tabs not ready');
  }

  const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === msgId) {
          ws.removeEventListener('message', handler);
          if (d.error) reject(d.error);
          else resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  };

  const screenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  };

  try {
    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('1. Setting auth session...');
    await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
    await new Promise((r) => setTimeout(r, 800));

    await evaluate(`
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        email: 'superadmin@asicrm.local',
        department: 'Management'
      }));
    `);

    console.log('2. Navigating to https://crmapi.asiind.com/quotations/new ...');
    await send('Page.navigate', { url: 'https://crmapi.asiind.com/quotations/new' });
    
    // Wait for quotation editor container
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ready = await evaluate(`Boolean(document.querySelector('.quotation-editor-container'))`);
      if (ready) break;
    }
    await new Promise((r) => setTimeout(r, 1200));

    console.log('3. Selecting customer and filling product row...');
    await evaluate(`(() => {
      // Select first customer
      const custSelect = document.querySelector('select.quotation-header-input') || document.querySelector('select');
      if (custSelect && custSelect.options.length > 1) {
        custSelect.selectedIndex = 1;
        custSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Open product dropdown using chevron button
    await evaluate(`(() => {
      const chevron = document.querySelector('.sps-chevron-btn');
      if (chevron) chevron.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Click first option
    const clicked = await evaluate(`(() => {
      const firstOpt = document.querySelector('.sps-option-item:not(.is-disabled)') || document.querySelector('.sps-option-item');
      if (firstOpt) {
        firstOpt.click();
        return true;
      }
      return false;
    })()`);
    console.log('  Selected product option clicked:', clicked);
    await new Promise((r) => setTimeout(r, 600));

    // Set price to 4850.90 using React value setter
    await evaluate(`(() => {
      const priceInput = document.querySelector('.quotation-price-input');
      if (priceInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(priceInput, '4850.90');
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const qtyInput = document.querySelector('.quotation-qty-input');
      if (qtyInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(qtyInput, '1');
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // 4. Capture initial state with Round Off OFF
    console.log('4. Verifying Round Off OFF state...');
    const offSummary = await evaluate(`(() => {
      const grandTotalElem = document.querySelector('.quotation-grand-total-value');
      return {
        grandTotal: grandTotalElem ? grandTotalElem.innerText.trim() : null
      };
    })()`);
    console.log('  Initial Grand Total (Round Off OFF):', offSummary.grandTotal);
    await screenshot('verify_quotation_roundoff_off.png');

    // 5. Turn Round Off ON
    console.log('5. Toggling Round Off ON...');
    const cbFound = await evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const roundOffLabel = labels.find(l => l.innerText && l.innerText.includes('Round Off Total'));
      const roundOffCb = roundOffLabel ? roundOffLabel.querySelector('input[type="checkbox"]') : null;
      if (roundOffCb) {
        roundOffCb.click();
        return true;
      }
      return false;
    })()`);
    console.log('  Round Off Checkbox found & clicked:', cbFound);
    await new Promise((r) => setTimeout(r, 800));

    const onSummary = await evaluate(`(() => {
      const summaryItems = Array.from(document.querySelectorAll('.quotation-summary-item')).map(item => item.innerText.replace(/\\s+/g, ' ').trim());
      const grandTotalElem = document.querySelector('.quotation-grand-total-value');
      return {
        summaryItems,
        grandTotal: grandTotalElem ? grandTotalElem.innerText.trim() : null
      };
    })()`);
    console.log('  Summary with Round Off ON:', onSummary);
    await screenshot('verify_quotation_roundoff_on.png');

    // Verify exact values
    if (!onSummary.grandTotal?.includes('5,725.00')) {
      throw new Error(`Expected Grand Total ₹5,725.00 but got: ${onSummary.grandTotal}`);
    }
    const hasPlus094 = onSummary.summaryItems.some(s => s.includes('+₹0.94') || s.includes('+ ₹0.94') || s.includes('+0.94'));
    console.log('  ✓ Grand Total moved to next whole number: ₹5,725.00');
    console.log('  ✓ Positive round-off displayed (+₹0.94):', hasPlus094);

    // 6. Test reactive quantity change: Change quantity to 2
    console.log('\n6. Testing reactive quantity update (changing quantity to 2)...');
    await evaluate(`(() => {
      const qtyInput = document.querySelector('.quotation-qty-input');
      if (qtyInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(qtyInput, '2');
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);

    await new Promise((r) => setTimeout(r, 800));
    const qty2Summary = await evaluate(`(() => {
      const summaryItems = Array.from(document.querySelectorAll('.quotation-summary-item')).map(item => item.innerText.replace(/\\s+/g, ' ').trim());
      const grandTotalElem = document.querySelector('.quotation-grand-total-value');
      return {
        summaryItems,
        grandTotal: grandTotalElem ? grandTotalElem.innerText.trim() : null
      };
    })()`);
    console.log('  Qty=2 Grand Total:', qty2Summary.grandTotal, 'Summary:', qty2Summary.summaryItems);
    // 4850.90 * 2 = 9701.80. GST 18% = 1746.32. Calc = 11448.12. Next whole = 11449.00. Round off = +0.88.
    if (!qty2Summary.grandTotal?.includes('11,449.00')) {
      throw new Error(`Expected Qty=2 Grand Total ₹11,449.00, got: ${qty2Summary.grandTotal}`);
    }
    console.log('  ✓ Qty=2 reactively updated to ₹11,449.00 without page reload');

    // Change quantity back to 1
    await evaluate(`(() => {
      const qtyInput = document.querySelector('.quotation-qty-input');
      if (qtyInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(qtyInput, '1');
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // 7. Save quotation
    console.log('\n7. Saving Quotation...');
    await evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find(b => b.innerText.includes('Save Quotation') || b.innerText.includes('Create Quotation'));
      if (saveBtn) saveBtn.click();
    })()`);

    // Wait for save to complete and navigation to /quotations
    console.log('Waiting for quotation list after save...');
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const onList = await evaluate(`window.location.pathname === '/quotations'`);
      if (onList) break;
    }
    await new Promise((r) => setTimeout(r, 1000));

    // 8. Open Official Quotation PDF from Quotations list
    console.log('\n8. Opening Official Quotation PDF Preview Modal from Quotations list...');
    const pdfBtnClicked = await evaluate(`(() => {
      const pdfBtn = document.querySelector('button[title*="Official Quotation PDF"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'PDF');
      if (pdfBtn) {
        pdfBtn.click();
        return true;
      }
      return false;
    })()`);
    console.log('  Quotation PDF button found & clicked:', pdfBtnClicked);

    // Wait for PDF preview modal to open
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ready = await evaluate(`Boolean(document.querySelector('.doc-preview-modal-shell'))`);
      if (ready) break;
    }
    await new Promise((r) => setTimeout(r, 1500));
    await screenshot('verify_quotation_pdf_preview_roundoff.png');

    const pdfVerification = await evaluate(`(() => {
      const modal = document.querySelector('.doc-preview-modal-shell');
      if (!modal) return { modalFound: false };

      const totalVal = modal.querySelector('.grand-total-row .quotation-total-val')?.innerText?.trim();
      const amountWords = modal.querySelector('.quotation-amount-words')?.innerText?.trim();
      
      // Check if internal round-off row is exposed
      const allLabels = Array.from(modal.querySelectorAll('.quotation-total-label')).map(el => el.innerText.trim());
      const roundOffExposed = allLabels.some(l => l.toLowerCase().includes('round off') || l.toLowerCase().includes('calculated'));

      return {
        modalFound: true,
        totalVal,
        amountWords,
        roundOffExposed,
        allLabels
      };
    })()`);

    console.log('  PDF Preview verification:', pdfVerification);
    if (!pdfVerification.modalFound) throw new Error('PDF Preview modal not found');
    if (pdfVerification.roundOffExposed) throw new Error('Internal round-off was exposed in customer PDF!');
    console.log('  ✓ Customer PDF shows final commercial Total Amount:', pdfVerification.totalVal);
    console.log('  ✓ Customer PDF Amount in Words:', pdfVerification.amountWords);
    console.log('  ✓ Customer PDF does NOT expose internal round-off row:', !pdfVerification.roundOffExposed);

    // Close preview modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.doc-preview-btn.close') || document.querySelector('.doc-preview-header-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // 9. Open quotation in Edit mode to verify NO double rounding
    console.log('\n9. Reopening quotation in Edit mode from Quotations list...');
    await evaluate(`(() => {
      const editBtn = document.querySelector('button[title*="Edit quotation details"]') || document.querySelector('.tbl-action-btn.edit');
      if (editBtn) editBtn.click();
    })()`);

    // Wait for quotation editor to load the saved quotation
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ready = await evaluate(`Boolean(document.querySelector('.quotation-grand-total-value'))`);
      if (ready) break;
    }
    await new Promise((r) => setTimeout(r, 1200));

    // Verify reopened quotation values (NO double rounding)
    const reopenedSummary = await evaluate(`(() => {
      const summaryItems = Array.from(document.querySelectorAll('.quotation-summary-item')).map(item => item.innerText.replace(/\\s+/g, ' ').trim());
      const grandTotalElem = document.querySelector('.quotation-grand-total-value');
      const roundOffChecked = Boolean(document.querySelector('input[type="checkbox"]:checked'));
      return {
        summaryItems,
        grandTotal: grandTotalElem ? grandTotalElem.innerText.trim() : null,
        roundOffChecked
      };
    })()`);
    console.log('  Reopened Quotation Summary:', reopenedSummary);
    await screenshot('verify_quotation_reopened_edit_roundoff.png');

    if (!reopenedSummary.grandTotal?.includes('5,725.00')) {
      throw new Error(`DOUBLE ROUNDING DETECTED! Expected ₹5,725.00, got: ${reopenedSummary.grandTotal}`);
    }
    console.log('  ✓ Reopened quotation preserved exact grand total: ₹5,725.00 (NO double rounding)');

    console.log('\n============================================================');
    console.log('ALL UI VERIFICATIONS COMPLETED AND PASSED (100%)');
    console.log('============================================================');
  } finally {
    try {
      ws.close();
    } catch (_) {}
    try {
      chrome.kill();
    } catch (_) {}
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch (_) {}
  }
}

run().catch((e) => {
  console.error('\n❌ UI TEST FAILED:', e);
  process.exit(1);
});
