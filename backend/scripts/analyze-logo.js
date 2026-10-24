const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function analyze() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-001', role: 'SUPER_ADMIN', permissions: ['*'] }));
  });

  await page.goto('https://crmapi.asiind.com/quotations', { waitUntil: 'networkidle2' });
  
  // Find row with QT-000101 and click PDF
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const row = rows.find(r => r.innerText.includes('QT-000101'));
    if (row) {
      const pdfBtn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.trim() === 'PDF');
      if (pdfBtn) pdfBtn.click();
    }
  });

  await page.waitForSelector('.quotation-header-layout', { timeout: 8000 });
  await new Promise(r => setTimeout(r, 1000));

  const metrics = await page.evaluate(() => {
    const header = document.querySelector('.quotation-header-layout');
    const logoContainer = document.querySelector('.quotation-header-logo');
    const img = document.querySelector('.quotation-header-logo-img');
    const comp = document.querySelector('.quotation-header-company');

    const hBox = header.getBoundingClientRect();
    const lBox = logoContainer.getBoundingClientRect();
    const iBox = img.getBoundingClientRect();
    const cBox = comp.getBoundingClientRect();

    return {
      header: { width: hBox.width, height: hBox.height },
      logoContainer: { width: lBox.width, height: lBox.height },
      image: { width: iBox.width, height: iBox.height },
      companyBlock: { width: cBox.width, height: cBox.height }
    };
  });

  console.log('Metrics in live app:');
  console.log(JSON.stringify(metrics, null, 2));

  await browser.close();
}

analyze().catch(console.error);
