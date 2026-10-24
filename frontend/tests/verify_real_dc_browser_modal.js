import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\pc\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

let chromePath = CHROME_PATHS.find((p) => fs.existsSync(p));
const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function run() {
  console.log('Launching browser with Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    console.log('Navigating to https://crmapi.asiind.com...');
    await page.goto('https://crmapi.asiind.com', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1500));

    // Handle login if present
    const emailField = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    if (emailField) {
      console.log('Logging in as admin...');
      await emailField.type('admin@asi.ind.in');
      const passField = await page.$('input[type="password"]');
      if (passField) await passField.type('Admin@123');
      const submitBtn = await page.$('button[type="submit"], button.btn-primary');
      if (submitBtn) await submitBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Set logged-in user in localStorage
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Administrator',
        email: 'admin@asi.ind.in',
        role: 'SUPER_ADMIN'
      }));
    });

    // 1. Navigate directly to /delivery-challans/DC/001/2026
    console.log('Navigating to /delivery-challans/DC/001/2026...');
    await page.goto('https://crmapi.asiind.com/delivery-challans/DC/001/2026', { waitUntil: 'domcontentloaded' });

    // Wait for the modal and PrintableDeliveryChallan to render
    console.log('Waiting for .printable-delivery-challan to appear...');
    await page.waitForSelector('.printable-delivery-challan', { timeout: 15000 });
    console.log('✓ Found .printable-delivery-challan in live modal!');

    // Wait for render stabilization
    await new Promise((r) => setTimeout(r, 1500));

    // Capture screenshot of DC-000116 modal
    const screenshotPath = path.join(ARTIFACTS_DIR, 'verify_dc_000116_dedup_and_branding.png');
    const dcElement = await page.$('.printable-delivery-challan');
    if (dcElement) {
      await dcElement.screenshot({ path: screenshotPath });
      console.log('✓ Captured DC-000116 element screenshot to:', screenshotPath);
    } else {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('✓ Captured page screenshot to:', screenshotPath);
    }

    // Inspect the exact rendered DOM text
    const domInspection = await page.evaluate(() => {
      const doc = document.querySelector('.printable-delivery-challan');
      if (!doc) return { error: 'No DC element' };

      const consigneeCell = doc.querySelector('.dc-parties-row.dc-parties-client-row .dc-parties-cell:nth-child(1)');
      const dispatchCell = doc.querySelector('.dc-parties-row.dc-parties-client-row .dc-parties-cell:nth-child(2)');
      const logoImg = doc.querySelector('.dc-doc-company-logo');

      const consigneePartyName = consigneeCell ? consigneeCell.querySelector('.dc-party-name')?.innerText : '';
      const consigneePartyCompany = consigneeCell ? consigneeCell.querySelector('.dc-party-company')?.innerText : null;
      const consigneeAddress = consigneeCell ? consigneeCell.querySelector('.dc-party-address')?.innerText : '';

      const dispatchPartyName = dispatchCell ? dispatchCell.querySelector('.dc-party-name')?.innerText : '';
      const dispatchPartyCompany = dispatchCell ? dispatchCell.querySelector('.dc-party-company')?.innerText : null;
      const dispatchAddress = dispatchCell ? dispatchCell.querySelector('.dc-party-address')?.innerText : '';

      return {
        consignee: {
          name: consigneePartyName,
          company: consigneePartyCompany,
          address: consigneeAddress
        },
        dispatch: {
          name: dispatchPartyName,
          company: dispatchPartyCompany,
          address: dispatchAddress
        },
        logoSrc: logoImg ? logoImg.getAttribute('src') : null,
        fullConsigneeText: consigneeCell ? consigneeCell.innerText : '',
        fullDispatchText: dispatchCell ? dispatchCell.innerText : ''
      };
    });

    console.log('\nDOM Inspection of DC-000116:', JSON.stringify(domInspection, null, 2));

    // Assertions:
    // Consignee party name must be "RK & Sons — Gomathi"
    if (domInspection.consignee.name !== 'RK & Sons — Gomathi') {
      throw new Error(`Expected Consignee name "RK & Sons — Gomathi", got "${domInspection.consignee.name}"`);
    }

    // Consignee company must be suppressed (null) because "Gomathi" is already in "RK & Sons — Gomathi"!
    if (domInspection.consignee.company) {
      throw new Error(`Expected Consignee company to be suppressed (null), but got "${domInspection.consignee.company}"!`);
    }

    // Dispatched to party name must be "Gomathi"
    if (domInspection.dispatch.name !== 'Gomathi') {
      throw new Error(`Expected Dispatch name "Gomathi", got "${domInspection.dispatch.name}"`);
    }

    // Dispatched to company must be suppressed (null) because "Gomathi" is identical to "Gomathi"!
    if (domInspection.dispatch.company) {
      throw new Error(`Expected Dispatch company to be suppressed (null), but got "${domInspection.dispatch.company}"!`);
    }

    // Verify company logo uses master branding URL
    if (!domInspection.logoSrc || (!domInspection.logoSrc.startsWith('data:image') && !domInspection.logoSrc.includes('asi'))) {
      throw new Error(`Expected master branding logo src, got "${domInspection.logoSrc}"`);
    }

    console.log('\n======================================================');
    console.log('✓ ISSUE A VERIFIED: Consignee displays "RK & Sons — Gomathi" without duplicate "Gomathi"!');
    console.log('✓ ISSUE B VERIFIED: Delivered / Dispatched To displays "Gomathi" without duplicate "Gomathi"!');
    console.log('✓ ISSUE C VERIFIED: Master branding logo properly propagated to Delivery Challan!');
    console.log('======================================================\n');

    // Also navigate to Settings -> Branding to capture settings UI screenshot
    console.log('Navigating to /settings/branding...');
    await page.goto('https://crmapi.asiind.com/settings/branding', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2000));

    const settingsScreenshotPath = path.join(ARTIFACTS_DIR, 'verify_settings_branding_page.png');
    await page.screenshot({ path: settingsScreenshotPath, fullPage: false });
    console.log('✓ Captured Settings Branding screenshot to:', settingsScreenshotPath);

    console.log('\n=== REAL BROWSER UI TEST COMPLETED WITH 100% SUCCESS! ===\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
