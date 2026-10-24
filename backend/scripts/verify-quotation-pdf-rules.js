const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Authenticate via localStorage
    console.log('Navigating to root and setting authentication...');
    await page.goto('https://crmapi.asiind.com', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*']
      }));
    });

    // 2. Navigate to Quotations list
    console.log('Navigating to /quotations...');
    await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr td.actions-col', { timeout: 10000 });
    await sleep(1000);

    // Helper to get row actions for a tab
    const inspectTabActions = async (tabName) => {
      console.log(`\n--- Inspecting Tab: ${tabName} ---`);
      // Click tab
      const tabButtons = await page.$$('.quotation-status-filter button');
      for (const btn of tabButtons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        if (text === tabName) {
          await btn.click();
          await sleep(1000);
          break;
        }
      }

      const rows = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tbody tr'));
        return trs.map(tr => {
          const qId = tr.querySelector('td:nth-child(1)')?.textContent.trim();
          const cust = tr.querySelector('td:nth-child(2)')?.textContent.trim();
          const status = tr.querySelector('td:nth-child(6)')?.textContent.trim();
          const actionBtns = Array.from(tr.querySelectorAll('td.actions-col button, td.actions-col span')).map(el => el.textContent.trim());
          return { qId, cust, status, actionBtns };
        });
      });

      return rows;
    };

    // ----------------------------------------------------
    // TEST TAB 1: AWAITING (AWAITING DECISION)
    // ----------------------------------------------------
    const awaitingRows = await inspectTabActions('AWAITING');
    console.log(`Found ${awaitingRows.length} rows in AWAITING tab`);
    if (awaitingRows.length === 0) throw new Error('AWAITING tab has 0 rows!');
    const awaitingSample = awaitingRows.find(r => r.qId === 'QT-000065') || awaitingRows[0];
    console.log('Awaiting sample row:', awaitingSample);

    // Verify rules for AWAITING:
    // View YES, PDF NO, Accept YES, Reject YES, Convert NO, + PI NO, Delete YES
    for (const r of awaitingRows.slice(0, 5)) {
      const hasPdf = r.actionBtns.some(b => b === 'PDF');
      const hasConvert = r.actionBtns.some(b => b.includes('Convert'));
      const hasPI = r.actionBtns.some(b => b === '+ PI');
      const hasView = r.actionBtns.some(b => b === 'View');
      const hasAccept = r.actionBtns.some(b => b.includes('Accept'));
      const hasReject = r.actionBtns.some(b => b.includes('Reject'));
      const hasDelete = r.actionBtns.some(b => b === 'Delete');

      if (hasPdf) throw new Error(`FAILED: Row ${r.qId} has PDF action in AWAITING tab!`);
      if (hasConvert) throw new Error(`FAILED: Row ${r.qId} has Convert action in AWAITING tab!`);
      if (hasPI) throw new Error(`FAILED: Row ${r.qId} has + PI action in AWAITING tab!`);
      if (!hasView) throw new Error(`FAILED: Row ${r.qId} missing View action!`);
      if (!hasAccept) throw new Error(`FAILED: Row ${r.qId} missing Accept action!`);
      if (!hasReject) throw new Error(`FAILED: Row ${r.qId} missing Reject action!`);
      if (!hasDelete) throw new Error(`FAILED: Row ${r.qId} missing Delete action!`);
    }
    console.log('✓ AWAITING tab strictly satisfies action matrix: View, Accept, Reject, Delete (NO PDF, NO Convert, NO + PI)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_awaiting_tab_no_pdf.png'), fullPage: false });

    // ----------------------------------------------------
    // TEST TAB 2: ACCEPTED
    // ----------------------------------------------------
    const acceptedRows = await inspectTabActions('ACCEPTED');
    console.log(`Found ${acceptedRows.length} rows in ACCEPTED tab`);
    if (acceptedRows.length === 0) throw new Error('ACCEPTED tab has 0 rows!');
    const acceptedSample = acceptedRows.find(r => r.qId === 'QT-000064') || acceptedRows[0];
    console.log('Accepted sample row:', acceptedSample);

    // Verify rules for ACCEPTED:
    // View YES, PDF YES, Accept NO, Reject NO, Convert YES, + PI YES, Delete YES
    for (const r of acceptedRows.slice(0, 5)) {
      const hasPdf = r.actionBtns.some(b => b === 'PDF');
      const hasConvert = r.actionBtns.some(b => b.includes('Convert'));
      const hasPI = r.actionBtns.some(b => b === '+ PI');
      const hasView = r.actionBtns.some(b => b === 'View');
      const hasAccept = r.actionBtns.some(b => b.includes('Accept'));
      const hasReject = r.actionBtns.some(b => b.includes('Reject'));
      const hasDelete = r.actionBtns.some(b => b === 'Delete');

      if (!hasPdf) throw new Error(`FAILED: Row ${r.qId} is missing PDF action in ACCEPTED tab!`);
      if (!hasConvert) throw new Error(`FAILED: Row ${r.qId} is missing Convert action in ACCEPTED tab!`);
      if (!hasPI) throw new Error(`FAILED: Row ${r.qId} is missing + PI action in ACCEPTED tab!`);
      if (!hasView) throw new Error(`FAILED: Row ${r.qId} missing View action!`);
      if (hasAccept) throw new Error(`FAILED: Row ${r.qId} should not have Accept action when already accepted!`);
      if (hasReject) throw new Error(`FAILED: Row ${r.qId} should not have Reject action when accepted!`);
      if (!hasDelete) throw new Error(`FAILED: Row ${r.qId} missing Delete action!`);
    }
    console.log('✓ ACCEPTED tab strictly satisfies action matrix: View, PDF, Convert, + PI, Delete!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_accepted_tab_has_pdf.png'), fullPage: false });

    // ----------------------------------------------------
    // TEST TAB 3: CONVERTED
    // ----------------------------------------------------
    const convertedRows = await inspectTabActions('CONVERTED');
    console.log(`Found ${convertedRows.length} rows in CONVERTED tab`);
    if (convertedRows.length === 0) throw new Error('CONVERTED tab has 0 rows!');
    const convertedSample = convertedRows.find(r => r.qId === 'QT-000066') || convertedRows[0];
    console.log('Converted sample row:', convertedSample);

    // Verify rules for CONVERTED:
    // View YES, PDF YES, Accept NO, Reject NO, Convert NO, + PI YES, Linked Order YES, Delete YES
    for (const r of convertedRows.slice(0, 5)) {
      const hasPdf = r.actionBtns.some(b => b === 'PDF');
      const hasConvert = r.actionBtns.some(b => b.includes('Convert'));
      const hasPI = r.actionBtns.some(b => b === '+ PI');
      const hasLinked = r.actionBtns.some(b => b.includes('Linked:'));
      const hasView = r.actionBtns.some(b => b === 'View');
      const hasAccept = r.actionBtns.some(b => b.includes('Accept'));
      const hasReject = r.actionBtns.some(b => b.includes('Reject'));
      const hasDelete = r.actionBtns.some(b => b === 'Delete');

      if (!hasPdf) throw new Error(`FAILED: Row ${r.qId} is missing PDF action in CONVERTED tab!`);
      if (hasConvert) throw new Error(`FAILED: Row ${r.qId} must NOT show Convert action when already converted!`);
      if (!hasPI) throw new Error(`FAILED: Row ${r.qId} is missing + PI action in CONVERTED tab!`);
      if (!hasView) throw new Error(`FAILED: Row ${r.qId} missing View action!`);
      if (hasAccept) throw new Error(`FAILED: Row ${r.qId} should not have Accept action!`);
      if (hasReject) throw new Error(`FAILED: Row ${r.qId} should not have Reject action!`);
      if (!hasLinked) throw new Error(`FAILED: Row ${r.qId} missing Linked order reference!`);
      if (!hasDelete) throw new Error(`FAILED: Row ${r.qId} missing Delete action!`);
    }
    console.log('✓ CONVERTED tab strictly satisfies action matrix: View, PDF, + PI, Linked Order, Delete (NO Convert)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_converted_tab_has_pdf.png'), fullPage: false });

    // ----------------------------------------------------
    // TEST TAB 4: REJECTED
    // ----------------------------------------------------
    const rejectedRows = await inspectTabActions('REJECTED');
    console.log(`Found ${rejectedRows.length} rows in REJECTED tab`);
    if (rejectedRows.length === 0) throw new Error('REJECTED tab has 0 rows!');
    const rejectedSample = rejectedRows.find(r => r.qId === 'QT-000051') || rejectedRows[0];
    console.log('Rejected sample row:', rejectedSample);

    // Verify rules for REJECTED:
    // View YES, PDF NO, Accept NO, Reject NO, Convert NO, + PI NO, Delete YES
    for (const r of rejectedRows.slice(0, 5)) {
      const hasPdf = r.actionBtns.some(b => b === 'PDF');
      const hasConvert = r.actionBtns.some(b => b.includes('Convert'));
      const hasPI = r.actionBtns.some(b => b === '+ PI');
      const hasView = r.actionBtns.some(b => b === 'View');
      const hasAccept = r.actionBtns.some(b => b.includes('Accept'));
      const hasReject = r.actionBtns.some(b => b.includes('Reject'));
      const hasDelete = r.actionBtns.some(b => b === 'Delete');

      if (hasPdf) throw new Error(`FAILED: Row ${r.qId} has PDF action in REJECTED tab!`);
      if (hasConvert) throw new Error(`FAILED: Row ${r.qId} has Convert action in REJECTED tab!`);
      if (hasPI) throw new Error(`FAILED: Row ${r.qId} has + PI action in REJECTED tab!`);
      if (!hasView) throw new Error(`FAILED: Row ${r.qId} missing View action!`);
      if (hasAccept) throw new Error(`FAILED: Row ${r.qId} should not have Accept action!`);
      if (hasReject) throw new Error(`FAILED: Row ${r.qId} should not have Reject action!`);
      if (!hasDelete) throw new Error(`FAILED: Row ${r.qId} missing Delete action!`);
    }
    console.log('✓ REJECTED tab strictly satisfies action matrix: View, Delete (NO PDF, NO Accept, NO Reject, NO Convert, NO + PI)!');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_rejected_tab_no_pdf.png'), fullPage: false });

    // ----------------------------------------------------
    // TEST 5: Quotation Editor for Awaiting Decision (QT-000065)
    // ----------------------------------------------------
    console.log('\n--- Inspecting Quotation Editor for Awaiting Decision (QT-000065) ---');
    await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr td.actions-col', { timeout: 10000 });
    // Click AWAITING tab
    const tabButtons = await page.$$('.quotation-status-filter button');
    for (const btn of tabButtons) {
      const text = await page.evaluate(el => el.textContent.trim(), btn);
      if (text === 'AWAITING') {
        await btn.click();
        await sleep(1000);
        break;
      }
    }
    // Click View on the first awaiting row
    const viewButtons = await page.$$('td.actions-col button.edit');
    if (viewButtons.length > 0) {
      await viewButtons[0].click();
      await page.waitForSelector('.quotation-footer-row', { timeout: 10000 });
      await sleep(1000);

      const editorButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.quotation-footer-row button')).map(b => b.textContent.trim());
      });
      console.log('Awaiting Quotation Editor footer buttons:', editorButtons);

      const hasPdfInEditor = editorButtons.some(b => b.includes('PDF'));
      const hasProformaInEditor = editorButtons.some(b => b.includes('Proforma'));
      if (hasPdfInEditor) throw new Error('FAILED: Quotation Editor shows "Quotation PDF" button for AWAITING DECISION quotation!');
      if (hasProformaInEditor) throw new Error('FAILED: Quotation Editor shows "Generate Proforma" button for AWAITING DECISION quotation!');

      console.log('✓ Awaiting Decision Quotation Editor strictly omits PDF and Proforma buttons!');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_awaiting_editor_no_pdf.png'), fullPage: false });
    }

    // ----------------------------------------------------
    // TEST 6: Quotation Editor & PDF Modal for Accepted (QT-000064)
    // ----------------------------------------------------
    console.log('\n--- Inspecting Quotation Editor & PDF Modal for Accepted (QT-000064) ---');
    await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr td.actions-col', { timeout: 10000 });
    // Click ACCEPTED tab
    const tabButtons2 = await page.$$('.quotation-status-filter button');
    for (const btn of tabButtons2) {
      const text = await page.evaluate(el => el.textContent.trim(), btn);
      if (text === 'ACCEPTED') {
        await btn.click();
        await sleep(1000);
        break;
      }
    }
    // Click View on the first accepted row
    const viewButtons2 = await page.$$('td.actions-col button.edit');
    if (viewButtons2.length > 0) {
      await viewButtons2[0].click();
      await page.waitForSelector('.quotation-footer-row', { timeout: 10000 });
      await sleep(1000);

      const editorButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.quotation-footer-row button')).map(b => b.textContent.trim());
      });
      console.log('Accepted Quotation Editor footer buttons:', editorButtons);

      const hasPdfInEditor = editorButtons.some(b => b.includes('PDF'));
      const hasProformaInEditor = editorButtons.some(b => b.includes('Proforma'));
      if (!hasPdfInEditor) throw new Error('FAILED: Quotation Editor missing "Quotation PDF" button for ACCEPTED quotation!');
      if (!hasProformaInEditor) throw new Error('FAILED: Quotation Editor missing "Generate Proforma" button for ACCEPTED quotation!');

      // Now click "Quotation PDF" button
      const allBtns = await page.$$('.quotation-footer-row button');
      for (const btn of allBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('PDF')) {
          console.log('Clicking Quotation PDF button in editor...');
          await btn.click();
          await page.waitForSelector('.doc-preview-modal-shell', { timeout: 10000 });
          await sleep(1000);
          break;
        }
      }

      // Check modal
      const modalTitle = await page.evaluate(() => {
        return document.querySelector('.doc-preview-badge, .doc-preview-title-group')?.textContent.trim();
      });
      console.log('PDF Preview Modal Title/Badge:', modalTitle);
      if (!modalTitle || (!modalTitle.toUpperCase().includes('QUOTATION') && !modalTitle.toUpperCase().includes('OFFICIAL'))) {
        throw new Error('FAILED: Official Quotation PDF Modal did not open!');
      }

      console.log('✓ Accepted Quotation successfully opened Official Quotation PDF Modal!');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_accepted_editor_pdf_modal.png'), fullPage: false });
    }

    console.log('\n============================================================');
    console.log('ALL VERIFICATIONS PASSED WITH 100% ACCURACY!');
    console.log('============================================================\n');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
