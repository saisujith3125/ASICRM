const puppeteer = require('../node_modules/puppeteer-core');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function runTest() {
  console.log('=== STARTING DC TITLE STATUS REMOVAL & DROPDOWN VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // 1. Setup user authentication
    await page.goto('https://crmapi.asiind.com/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        email: 'superadmin@asicrm.local',
        department: 'Management'
      }));
    });

    // 2. Check New DC Page Purpose Dropdown
    console.log('Navigating to New DC page...');
    await page.goto('https://crmapi.asiind.com/delivery-challans/new', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const options = await page.$$eval('.dc-group-purpose select option', opts => opts.map(o => ({ value: o.value, text: o.text })));
    console.log('DC Purpose Dropdown Options:', options);

    const expectedOptions = [
      { value: 'NORMAL', text: 'Delivery Challan' },
      { value: 'RETURNABLE', text: 'Return Delivery' }
    ];
    if (JSON.stringify(options) !== JSON.stringify(expectedOptions)) {
      throw new Error('DC Purpose options do not match expected! Found: ' + JSON.stringify(options));
    }
    console.log('PASS: DC Purpose dropdown correctly displays "Delivery Challan" and "Return Delivery"');

    // Switch to Return Delivery and verify badge changes to RETURN DELIVERY
    await page.select('.dc-group-purpose select', 'RETURNABLE');
    await new Promise((r) => setTimeout(r, 600));
    const badgeText = await page.$eval('.dc-page-header span', el => el.innerText);
    console.log('Header badge text after selecting Return Delivery:', badgeText);
    if (!badgeText.includes('RETURN DELIVERY')) {
      throw new Error('Header badge did not update to RETURN DELIVERY! Found: ' + badgeText);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_dropdown_return_delivery.png'), fullPage: false });

    // 3. Navigate directly to DC/001/2026 modal preview
    console.log('Navigating to https://crmapi.asiind.com/delivery-challans/DC/001/2026 ...');
    await page.goto('https://crmapi.asiind.com/delivery-challans/DC/001/2026', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const titleWrap142 = await page.$eval('.dc-top-title-wrap', el => el.innerText.trim());
    console.log('DC-000142 Title Header Text:', titleWrap142);
    if (titleWrap142 !== 'DELIVERY CHALLAN') {
      throw new Error('Expected title "DELIVERY CHALLAN", but got: ' + titleWrap142);
    }
    console.log('PASS: DC-000142 header has clean title "DELIVERY CHALLAN" with zero status badges!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_000142_clean_title.png'), fullPage: false });

    // 4. Navigate directly to DC-000132 modal preview (partially returned in user screenshot)
    console.log('Navigating to https://crmapi.asiind.com/delivery-challans/DC-000132 ...');
    await page.goto('https://crmapi.asiind.com/delivery-challans/DC-000132', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const titleWrap132 = await page.$eval('.dc-top-title-wrap', el => el.innerText.trim());
    console.log('DC-000132 Title Header Text:', titleWrap132);
    if (titleWrap132 !== 'DELIVERY CHALLAN' && titleWrap132 !== 'RETURN DELIVERY') {
      throw new Error('Unexpected title for DC-000132: ' + titleWrap132);
    }
    console.log('PASS: DC-000132 has clean title with zero status badges!');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_dc_000132_clean_title.png'), fullPage: false });

    console.log('=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
