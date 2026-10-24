import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function runVerification() {
  console.log('Starting Serial Numbers & Cable Flow Verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('asicrm_user', JSON.stringify({
      id: 'USR-001',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      mobile: '9999999990'
    }));
  });

  // 1. Visit Product Create Page
  console.log('1. Navigating to Product Create Page...');
  await page.goto('https://crmapi.asiind.com/stocks/products/new', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));
  const debugInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      bodyText: document.body.innerText.slice(0, 300),
      hasUser: localStorage.getItem('asicrm_user')
    };
  });
  console.log('DEBUG INFO:', JSON.stringify(debugInfo));
  await page.waitForSelector('.product-create-page', { timeout: 10000 });

  // Select "Cables" Category
  console.log('Selecting Category: Cables...');
  // Find the category SearchableSelect
  const categoryTrigger = await page.waitForSelector('.searchable-select-trigger');
  await categoryTrigger.click();
  await new Promise((r) => setTimeout(r, 400));

  // Find option for Cables
  const options = await page.$$('.searchable-select-option');
  for (const opt of options) {
    const text = await opt.evaluate((el) => el.innerText);
    if (text.includes('Cables')) {
      await opt.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 600));

  // Verify Cable Badge is visible
  const cableBadge = await page.evaluate(() => {
    const badge = Array.from(document.querySelectorAll('span')).find((el) =>
      el.innerText.includes('Disabled for Cables')
    );
    const checkbox = document.querySelector('input[type="checkbox"][disabled]');
    return {
      hasBadge: Boolean(badge),
      badgeText: badge ? badge.innerText : null,
      checkboxDisabled: Boolean(checkbox),
      checkboxChecked: checkbox ? checkbox.checked : null
    };
  });
  console.log('Cable Selection Result on Create Page:', cableBadge);

  await page.evaluate(() => {
    const cb = document.querySelector('input[type="checkbox"]');
    if (cb) cb.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'product_create_cable_disabled_serials.png'),
    fullPage: false
  });
  console.log('Saved product_create_cable_disabled_serials.png');

  // Select "IP Cameras" Category
  console.log('Selecting Category: IP Cameras...');
  await categoryTrigger.click();
  await new Promise((r) => setTimeout(r, 400));
  const options2 = await page.$$('.searchable-select-option');
  for (const opt of options2) {
    const text = await opt.evaluate((el) => el.innerText);
    if (text.includes('IP Cameras')) {
      await opt.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 600));

  // Enter Opening Stock = 2
  console.log('Entering Opening Stock = 2...');
  const stockInput = await page.$('input[placeholder="e.g. 0, 100"]');
  if (stockInput) {
    await stockInput.click({ clickCount: 3 });
    await stockInput.type('2');
  }
  await new Promise((r) => setTimeout(r, 600));

  // Verify Serial Numbers panel appears
  const serialPanel = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('span, div')).find((el) =>
      el.innerText.includes('Serial Numbers for Opening Stock')
    );
    const btn = Array.from(document.querySelectorAll('button')).find((el) =>
      el.innerText.includes('Auto-Generate Serial Numbers')
    );
    return {
      hasPanel: Boolean(panel),
      hasBtn: Boolean(btn)
    };
  });
  console.log('Serial Panel for Hardware:', serialPanel);

  // Click Auto-Generate Serial Numbers
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((el) =>
      el.innerText.includes('Auto-Generate Serial Numbers')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const generatedText = await page.evaluate(() => {
    const ta = document.querySelector('.product-create-section textarea');
    return ta ? ta.value : null;
  });
  console.log('Generated Serials in Textarea:\n', generatedText);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'product_create_hardware_auto_serials.png'),
    fullPage: false
  });
  console.log('Saved product_create_hardware_auto_serials.png');

  // 2. Visit Stock Movements Page & Test New Stock Movement Modal
  console.log('2. Navigating to Stock Movements Page...');
  await page.goto('https://crmapi.asiind.com/stocks/movements', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.stock-movements-workspace, .crm-btn-primary', { timeout: 10000 });

  // Open "New Movement" modal
  console.log('Opening New Movement Modal...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((el) =>
      el.innerText.includes('New Stock Entry') || el.innerText.includes('New Movement') || el.innerText.includes('Record Movement')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  await page.waitForSelector('.crm-modal-backdrop', { timeout: 8000 });

  // Select Cat 6 Cable in the Product dropdown
  console.log('Selecting Cat 6 Cable in movement modal...');
  await page.evaluate(() => {
    const select = document.querySelector('.crm-modal-card select');
    if (select) {
      const opt = Array.from(select.options).find((o) => o.text.includes('Cat 6 Cable') || o.text.includes('ASI-18'));
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  // Enter Quantity = 50
  const qtyInput = await page.$('.crm-modal-card input[type="number"], .crm-modal-card input[placeholder="e.g. 10"]');
  if (qtyInput) {
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type('50');
  }
  await new Promise((r) => setTimeout(r, 600));

  // Check if Cable notice is present and no serial numbers box
  const cableNotice = await page.evaluate(() => {
    const notice = Array.from(document.querySelectorAll('div')).find((el) =>
      el.innerText.includes('Cable Item:') && el.innerText.includes('Cables do not require')
    );
    const serialsHeader = Array.from(document.querySelectorAll('label')).find((el) =>
      el.innerText.includes('Serial Numbers for Stock In')
    );
    return {
      hasCableNotice: Boolean(notice),
      hasSerialsHeader: Boolean(serialsHeader)
    };
  });
  console.log('Cable in Stock In Modal Result:', cableNotice);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'stock_in_cable_no_serials.png'),
    fullPage: false
  });
  console.log('Saved stock_in_cable_no_serials.png');

  // Select a serialized Camera in Product dropdown
  console.log('Selecting Serialized Camera in movement modal...');
  await page.evaluate(() => {
    const select = document.querySelector('.crm-modal-card select');
    if (select) {
      const opt = Array.from(select.options).find((o) => o.text.includes('Camera') || o.text.includes('CAM-IPC-001'));
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  // Enter Quantity = 2
  if (qtyInput) {
    await qtyInput.click({ clickCount: 3 });
    await qtyInput.type('2');
  }
  await new Promise((r) => setTimeout(r, 600));

  // Click "Auto-Generate Computer Serials"
  console.log('Clicking Auto-Generate Computer Serials in movement modal...');
  const clickedMovementBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((el) =>
      el.innerText.includes('Auto-Generate Computer Serials')
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked movement auto gen:', clickedMovementBtn);
  await new Promise((r) => setTimeout(r, 1200));

  const modalSerialsText = await page.evaluate(() => {
    const ta = document.querySelector('.crm-modal-body textarea');
    const badge = Array.from(document.querySelectorAll('span')).find((el) =>
      el.innerText.includes('Complete') || el.innerText.includes('Entered')
    );
    return {
      textareaValue: ta ? ta.value : null,
      badgeText: badge ? badge.innerText : null
    };
  });
  console.log('Modal Computer Serials Result:', modalSerialsText);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'stock_in_hardware_computer_serials.png'),
    fullPage: false
  });
  console.log('Saved stock_in_hardware_computer_serials.png');

  await browser.close();
  console.log('Verification completed successfully!');
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
