const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'backend', 'node_modules', 'puppeteer-core'));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';
const BASE_URL = 'http://127.0.0.1:5173';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,960']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('asicrm_auth_token', 'mock');
    localStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-001', role: 'SUPER_ADMIN' }));
    sessionStorage.setItem('asicrm_auth_token', 'mock');
    sessionStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-001', role: 'SUPER_ADMIN' }));
  });

  await page.goto(`${BASE_URL}/quotations/QT-000113`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  const btn = await page.$('button[title*="Quotation PDF"]');
  if (btn) await btn.click();
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const p2 = document.querySelectorAll('.doc-quotation-page')[1];
    if (p2) p2.scrollIntoView();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'quotation_customer_facing_pdf_page2_table.png')
  });
  console.log('Page 2 captured successfully.');
  await browser.close();
})().catch(console.error);
