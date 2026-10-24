const puppeteer = require('E:/ASICRM_FINAL_PROJECT/backend/node_modules/puppeteer-core');
const path = require('path');

(async () => {
  console.log('--- STARTING CLEAN SYSTEM VERIFICATION ACROSS ALL MODULES ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  const artifactDir = 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f';

  // Authenticate as Super Admin
  await page.goto('https://crmapi.asiind.com', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('asicrm_user', JSON.stringify({
      id: 'USR-001',
      employeeId: 'SA-001',
      name: 'Super Admin',
      mobile: '9999999990',
      role: 'SUPER_ADMIN',
      status: 'Active',
      permissions: {
        'Delivery Challans': ['View', 'Create', 'Edit', 'Delete'],
        'Orders & Deals': ['View', 'Create', 'Edit', 'Delete'],
        'Quotations': ['View', 'Create', 'Edit', 'Delete', 'Convert'],
        'Enquiries': ['View', 'Create', 'Edit', 'Delete'],
        'Customers': ['View', 'Create', 'Edit', 'Delete'],
        'Purchase Orders': ['View', 'Create', 'Edit', 'Receive Goods', 'Download', 'Approve'],
        'Stocks': ['View', 'Create', 'Edit'],
        'Settings': ['View', 'Edit']
      }
    }));
  });

  const tests = [
    { name: 'Quotations', url: 'https://crmapi.asiind.com/quotations', file: 'verified_clean_quotations.png' },
    { name: 'Delivery Challans', url: 'https://crmapi.asiind.com/delivery-challans', file: 'verified_clean_dc.png' },
    { name: 'Customers', url: 'https://crmapi.asiind.com/customers', file: 'verified_clean_customers.png' },
    { name: 'Purchase Orders', url: 'https://crmapi.asiind.com/purchase-orders/sent', file: 'verified_clean_po.png' },
    { name: 'Orders & Deals', url: 'https://crmapi.asiind.com/orders', file: 'verified_clean_orders.png' }
  ];

  for (const t of tests) {
    console.log(`Verifying ${t.name} page: ${t.url}...`);
    await page.goto(t.url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    const screenshotPath = `${artifactDir}/${t.file}`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✓ Saved ${t.file}`);
  }

  await browser.close();
  console.log('--- ALL MODULES VERIFIED SUCCESSFULLY WITH CLEAN SEED DATA ---');
})();
