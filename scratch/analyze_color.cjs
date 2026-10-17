const fs = require('fs');
const puppeteer = require('E:/ASICRM_FINAL_PROJECT/frontend/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const imgPath = 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/.user_uploaded/media_1791179109801.png';
  const imgData = fs.readFileSync(imgPath).toString('base64');
  await page.setContent(`<!DOCTYPE html><html><body><img id="logo" src="data:image/png;base64,${imgData}"><canvas id="c"></canvas></body></html>`);
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
      // ASI green is chartreuse/lime green (R ~160-190, G ~200-220, B ~20-50)
      if (a > 200 && g > 160 && g > b * 2.5 && r > 120) {
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        greenCounts[hex] = (greenCounts[hex] || 0) + 1;
      }
    }
    const sorted = Object.entries(greenCounts).sort((a,b) => b[1] - a[1]);
    return {
      dimensions: { width: img.naturalWidth, height: img.naturalHeight },
      topGreens: sorted.slice(0, 10)
    };
  });
  console.log('LOGO COLOR ANALYSIS:', JSON.stringify(result, null, 2));
  await browser.close();
})();
