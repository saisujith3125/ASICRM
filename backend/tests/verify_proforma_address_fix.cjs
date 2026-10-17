const puppeteer = require('../node_modules/puppeteer-core');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function runTest() {
  console.log('=== STARTING PROFORMA INVOICE ADDRESS FIX VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // 1. Log in or setup authentication
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        email: 'superadmin@asicrm.local',
        department: 'Management'
      }));
    });

    // 2. Navigate to PI-000032 viewer
    console.log('Navigating to http://127.0.0.1:5173/orders/proformas/PI-000032 ...');
    await page.goto('http://127.0.0.1:5173/orders/proformas/PI-000032', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Inspect Consignee Pane lines
    const consigneeLines = await page.evaluate(() => {
      const pane = document.querySelector('.doc-inv-party-pane.border-right');
      if (!pane) return null;
      const lines = Array.from(pane.querySelectorAll('.doc-inv-party-line, .doc-inv-party-name, .doc-inv-party-gstin'))
        .map(el => el.innerText.trim());
      return lines;
    });

    console.log('Consignee Pane Lines:', consigneeLines);

    if (!consigneeLines) {
      throw new Error('Consignee pane not found on page!');
    }

    // Verify:
    // 1. No standalone 'Chennai' duplicate line
    const chennaiOnlyLines = consigneeLines.filter(l => l.toLowerCase() === 'chennai');
    if (chennaiOnlyLines.length > 0) {
      throw new Error('Found redundant "Chennai" line: ' + JSON.stringify(chennaiOnlyLines));
    }

    // 2. Contains 'Vanagaram, Chennai - 600095'
    const hasVanagaramLine = consigneeLines.some(l => l.includes('Vanagaram, Chennai - 600095'));
    if (!hasVanagaramLine) {
      throw new Error('Did not find "Vanagaram, Chennai - 600095" line in: ' + JSON.stringify(consigneeLines));
    }

    console.log('PASS: No redundant Chennai line found, and "Vanagaram, Chennai - 600095" is present!');

    // 4. Capture screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, 'test_proforma_address_chennai_fixed.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Screenshot saved to:', screenshotPath);

    console.log('=== VERIFICATION COMPLETED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
