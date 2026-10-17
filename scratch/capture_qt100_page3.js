const puppeteer = require('../frontend/node_modules/puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,1100']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('asicrm_auth_token', 'mock');
    localStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-001', role: 'SUPER_ADMIN' }));
    sessionStorage.setItem('asicrm_auth_token', 'mock');
    sessionStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-001', role: 'SUPER_ADMIN' }));
  });

  await page.goto('http://127.0.0.1:5173/quotations/QT-000100', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText && b.innerText.includes('Quotation PDF'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));

  // Directly capture page 3 element
  const p3Handle = await page.evaluateHandle(() => {
    const pages = document.querySelectorAll('.doc-quotation-page');
    return pages.length >= 3 ? pages[2] : null;
  });
  if (p3Handle && p3Handle.asElement()) {
    const p3Path = path.join('C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f', 'test_quotation_qt100_page3.png');
    await p3Handle.asElement().screenshot({ path: p3Path });
    console.log('Page 3 element screenshot saved to', p3Path);
  } else {
    console.log('No page 3 found');
  }

  await browser.close();
})().catch(console.error);
