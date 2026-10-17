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

  // Open Quotation PDF Preview Modal
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText && b.innerText.includes('Quotation PDF'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Quotation PDF button:', clicked);
  await new Promise(r => setTimeout(r, 2000));

  // Scroll paper container down to reveal Page 2
  await page.evaluate(() => {
    const paper = document.querySelector('.doc-preview-paper');
    const pages = document.querySelectorAll('.doc-quotation-page');
    console.log('Quotation pages count:', pages.length);
    if (pages.length >= 2) {
      pages[1].scrollIntoView();
    } else if (paper) {
      paper.scrollTop = 1150;
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // Directly capture page 2 element
  const p2Handle = await page.evaluateHandle(() => {
    const pages = document.querySelectorAll('.doc-quotation-page');
    return pages.length >= 2 ? pages[1] : (pages[0] || null);
  });
  if (p2Handle && p2Handle.asElement()) {
    const p2Path = path.join('C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f', 'test_quotation_qt100_centered_table.png');
    await p2Handle.asElement().screenshot({ path: p2Path });
    console.log('Page 2 element screenshot saved to', p2Path);
  }

  await browser.close();
})().catch(console.error);
