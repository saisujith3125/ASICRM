const puppeteer = require('../node_modules/puppeteer-core');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function runTest() {
  console.log('=== STARTING REF NO / PENDING DELIVERY MODE TOGGLE TEST ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // Setup user
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        email: 'superadmin@asicrm.local',
        department: 'Management'
      }));
      // Clear draft to test fresh render
      sessionStorage.removeItem('asicrm_dc_draft');
    });

    await page.goto('http://127.0.0.1:5173/delivery-challans/new', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Check mode selector exists
    const modeSelect = await page.$('.dc-group-ref-no select.dc-ref-mode-select');
    if (!modeSelect) throw new Error('Mode select .dc-ref-mode-select not found!');
    
    const initialMode = await page.evaluate(el => el.value, modeSelect);
    console.log('Initial Mode value:', initialMode);

    // Verify initial is PENDING and combobox exists
    const pendingInput = await page.$('.dc-group-ref-no .sps-direct-input');
    if (!pendingInput) throw new Error('Pending DC dropdown input not found in PENDING mode!');
    
    console.log('Taking screenshot of initial PENDING mode...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_ref_mode_pending.png'), fullPage: false });

    // 2. Switch to REF_NO
    console.log('Switching to REF_NO mode...');
    await page.select('.dc-group-ref-no select.dc-ref-mode-select', 'REF_NO');
    await new Promise((r) => setTimeout(r, 800));

    // Verify text box is present
    const refTextBox = await page.$('.dc-group-ref-no input.dc-manual-ref-input');
    if (!refTextBox) throw new Error('Manual Ref No text box not found after switching to REF_NO mode!');

    const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), refTextBox);
    console.log('Ref No Text Box Placeholder:', placeholder);

    // Type a sample ref number
    await refTextBox.type('PO-2026-X8890');
    await new Promise((r) => setTimeout(r, 500));

    console.log('Taking screenshot of REF_NO mode with typed text...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_ref_mode_textbox.png'), fullPage: false });

    // 3. Switch back to PENDING
    console.log('Switching back to PENDING mode...');
    await page.select('.dc-group-ref-no select.dc-ref-mode-select', 'PENDING');
    await new Promise((r) => setTimeout(r, 800));

    const pendingInputReappeared = await page.$('.dc-group-ref-no .sps-direct-input');
    if (!pendingInputReappeared) throw new Error('Pending DC dropdown input did not reappear!');

    console.log('Taking screenshot of returned PENDING mode...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_ref_mode_switched_back.png'), fullPage: false });

    console.log('=== TEST PASSED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
