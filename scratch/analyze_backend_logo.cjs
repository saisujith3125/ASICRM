const fs = require('fs');
const puppeteer = require('E:/ASICRM_FINAL_PROJECT/frontend/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const ac = JSON.parse(fs.readFileSync('E:/ASICRM_FINAL_PROJECT/backend/data/access-control.json'));
  const logoUrl = ac.companySettings.logoUrl;
  await page.setContent(`<!DOCTYPE html><html><body><img id="logo" src="${logoUrl}"><canvas id="c"></canvas></body></html>`);
  const result = await page.evaluate(() => {
    const img = document.getElementById('logo');
    const c = document.getElementById('c');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const greenCounts = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a > 200 && g > 160 && g > b * 2 && r > 120) {
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        greenCounts[hex] = (greenCounts[hex] || 0) + 1;
      }
    }
    const sorted = Object.entries(greenCounts).sort((a,b) => b[1] - a[1]);
    return {
      naturalDimensions: { width: img.naturalWidth, height: img.naturalHeight },
      topGreens: sorted.slice(0, 10)
    };
  });
  console.log('BACKEND LOGO ASSET ANALYSIS:', JSON.stringify(result, null, 2));
  await browser.close();
})();
