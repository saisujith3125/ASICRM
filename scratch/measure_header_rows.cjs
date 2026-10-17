const fs = require('fs');
const puppeteer = require('E:/ASICRM_FINAL_PROJECT/frontend/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1200']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('asicrm_user', JSON.stringify({
      id: 'USR-001',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      email: 'admin@asi.ind.in',
      phone: '9840012345'
    }));
  });

  await page.goto('http://localhost:5173/quotations', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    for (const row of rows) {
      if (row.textContent.includes('QT-000100')) {
        const pdfBtn = Array.from(row.querySelectorAll('button')).find(
          b => b.textContent.trim() === 'PDF' || b.title?.includes('Download Official Quotation PDF')
        );
        if (pdfBtn) pdfBtn.click();
      }
    }
  });

  await new Promise(r => setTimeout(r, 3000));

  const measurements = await page.evaluate(() => {
    const p1 = document.querySelector('.doc-quotation-page');
    const header = p1.querySelector('.quotation-header-layout');
    const logoCont = p1.querySelector('.quotation-header-logo');
    const logoImg = p1.querySelector('.quotation-header-logo-img');
    const compBlock = p1.querySelector('.quotation-header-company');
    const compName = p1.querySelector('.quotation-company-name');
    const compAddr = p1.querySelector('.quotation-company-address');
    const contactRows = Array.from(p1.querySelectorAll('.quotation-contact-row'));

    const hRect = header.getBoundingClientRect();
    const lRect = logoImg.getBoundingClientRect();

    const rowsInfo = contactRows.map((row, idx) => {
      const r = row.getBoundingClientRect();
      return {
        idx,
        text: row.innerText.replace(/\s+/g, ' ').trim(),
        topRelToHeader: r.top - hRect.top,
        bottomRelToHeader: r.bottom - hRect.top,
        height: r.height
      };
    });

    return {
      headerTop: hRect.top,
      headerHeight: hRect.height,
      logoImg: {
        width: lRect.width,
        height: lRect.height,
        topRelToHeader: lRect.top - hRect.top,
        bottomRelToHeader: lRect.bottom - hRect.top
      },
      compName: {
        text: compName.innerText,
        topRel: compName.getBoundingClientRect().top - hRect.top,
        bottomRel: compName.getBoundingClientRect().bottom - hRect.top
      },
      compAddr: {
        topRel: compAddr.getBoundingClientRect().top - hRect.top,
        bottomRel: compAddr.getBoundingClientRect().bottom - hRect.top
      },
      contactRows: rowsInfo
    };
  });

  console.log('HEADER MEASUREMENTS:', JSON.stringify(measurements, null, 2));
  await browser.close();
})();
