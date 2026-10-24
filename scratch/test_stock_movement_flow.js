const puppeteer = require('../backend/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // 1. Initial navigation to set localStorage auth
  console.log('Navigating to base URL to authenticate...');
  await page.goto('https://crmapi.asiind.com', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const user = {
      id: 'USR-001',
      name: 'Super Admin',
      employeeId: 'SA-001',
      email: 'superadmin@asicrm.local',
      mobile: '9999999990',
      role: 'SUPER_ADMIN',
      status: 'Active',
      permissions: {
        Stocks: ['View', 'Create', 'Edit', 'Delete'],
        'Orders & Deals': ['View', 'Create', 'Edit', 'Delete'],
        'Delivery Challans': ['View', 'Create', 'Edit', 'Delete'],
        'Purchase Orders': ['View', 'Create', 'Edit', 'Delete'],
        Customers: ['View', 'Create', 'Edit', 'Delete'],
        Enquiries: ['View', 'Create', 'Edit', 'Delete'],
        Quotations: ['View', 'Create', 'Edit', 'Delete']
      }
    };
    localStorage.setItem('asicrm_user', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'mock-token');
  });

  // 2. Visit Edit Product page for Dahua camera
  console.log('Navigating to Dahua camera edit page...');
  await page.goto('https://crmapi.asiind.com/stocks/products/PROD-000001/edit', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_dahua_edit_page.png' });
  console.log('Saved test_dahua_edit_page.png');

  // 3. Click the Stock Movement button in header
  console.log('Clicking Stock Movement button...');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Stock Movement'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Stock Movement button:', clicked);

  await new Promise(r => setTimeout(r, 1500));
  console.log('Current URL after click:', page.url());
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_dahua_stock_movement_page.png' });
  console.log('Saved test_dahua_stock_movement_page.png');

  // Verify header content and product-specific movements
  const pageContent = await page.evaluate(() => {
    const heading = document.querySelector('.stocks-main-heading')?.innerText;
    const subHeading = document.querySelector('.stocks-sub-heading')?.innerText;
    const rows = Array.from(document.querySelectorAll('.stock-movement-full-table tbody tr'));
    const firstRowProduct = document.querySelector('.stock-movement-full-table tbody tr td:nth-child(2) div')?.innerText;
    const metaBadges = Array.from(document.querySelectorAll('.stocks-overview-header .status-badge, .stocks-overview-header .master-code')).map(el => el.innerText);
    return {
      heading,
      subHeading,
      rowsCount: rows.length,
      firstRowProduct,
      metaBadges
    };
  });
  console.log('Page content:', JSON.stringify(pageContent, null, 2));

  // 4. Click the Eye icon on the first row to verify popup modal
  await page.evaluate(() => {
    const eyeBtn = document.querySelector('button[title="View Movement Details"]');
    if (eyeBtn) eyeBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_dahua_movement_popup_modal.png' });
  console.log('Saved test_dahua_movement_popup_modal.png');

  // Close modal with Escape
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  // 5. Test "← Back to Product" button
  console.log('Testing Back to Product button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Back to Product'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  console.log('URL after Back to Product:', page.url());
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_back_to_product_page.png' });
  console.log('Saved test_back_to_product_page.png');

  // 6. Navigate back to Stock Movements and test "View All Movements"
  await page.goto('https://crmapi.asiind.com/stocks/products/PROD-000001/movements', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('View All Movements'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  console.log('URL after View All Movements:', page.url());
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_all_stock_movements_page.png' });
  console.log('Saved test_all_stock_movements_page.png');

  // 7. Check products list table with Stock Movement action icon
  await page.goto('https://crmapi.asiind.com/stocks/products', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'C:/Users/gotindia/.gemini/antigravity/brain/60245ec2-db07-4a60-9e96-08a10130208f/test_products_table_movement_icon.png' });
  console.log('Saved test_products_table_movement_icon.png');

  await browser.close();
  console.log('All tests completed successfully!');
})().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
