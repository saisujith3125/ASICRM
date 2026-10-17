import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

// Locate local chrome
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\pc\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

let chromePath = CHROME_PATHS.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('Could not find chrome.exe');
  process.exit(1);
}

const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function test() {
  console.log('Launching browser with Chrome at:', chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });

    // Ensure logged in
    const isLoginPage = await page.$('input[type="password"]');
    if (isLoginPage) {
      console.log('Logging in as Admin...');
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[type="text"]');
      if (emailInput) {
        await emailInput.type('admin@asi.ind.in');
      }
      const passInput = await page.$('input[type="password"]');
      if (passInput) {
        await passInput.type('Admin@123');
      }
      const loginBtn = await page.$('button[type="submit"], button.btn-primary');
      if (loginBtn) {
        await loginBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
      }
    }

    // 1. Create or ensure customer "RK & Sons" with contact "Gomathi"
    console.log('Navigating to Delivery Challans overview...');
    await page.evaluate(() => {
      window.location.hash = '#/delivery-challans';
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to create new DC
    console.log('Navigating to New Delivery Challan page...');
    await page.evaluate(() => {
      window.location.hash = '#/delivery-challans/new';
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Type customer or select RK & Sons
    const custInput = await page.$('input[placeholder*="Customer" i], input[placeholder*="Search customer" i], .dc-customer-input');
    if (custInput) {
      await custInput.click({ clickCount: 3 });
      await custInput.type('RK & Sons — Gomathi');
    }

    // Set delivery address
    const addrInput = await page.$('textarea[name="deliveryAddress"], textarea[placeholder*="Address" i], textarea');
    if (addrInput) {
      await addrInput.click({ clickCount: 3 });
      await addrInput.type('No. 18, 21st street, Annanagar East, Chennai');
    }

    // Set receiver name
    const recInput = await page.$('input[placeholder*="Receiver" i], input[name="receiverName"]');
    if (recInput) {
      await recInput.click({ clickCount: 3 });
      await recInput.type('Gomathi');
    }

    // Fill delivery items if needed, or submit/view
    // Let's also check if an existing DC can be opened in the modal
    console.log('Returning to DC list to test DC document modal...');
    await page.evaluate(() => {
      window.location.hash = '#/delivery-challans';
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Look for View Document / Print button in the table
    const viewButtons = await page.$$('button[title*="View" i], button[title*="Print" i], button.btn-view-doc, .dc-btn-view, .action-btn-view');
    console.log(`Found ${viewButtons.length} view/print document buttons.`);

    if (viewButtons.length > 0) {
      await viewButtons[0].click();
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      // Or trigger modal directly via window dispatch or selecting first record
      const rows = await page.$$('.crm-master-table tbody tr');
      if (rows.length > 0) {
        const actionBtn = await rows[0].$('button');
        if (actionBtn) await actionBtn.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // If modal is open or let's test by mounting PrintableDeliveryChallan in page DOM directly
    console.log('Testing PrintableDeliveryChallan DOM rendering directly in browser context...');
    const result = await page.evaluate(async () => {
      // Inject simulated DC with Issue A & B
      const dcData = {
        challanId: 'DC-000115',
        customerName: 'RK & Sons — Gomathi',
        company: 'Gomathi',
        receiverName: 'Gomathi',
        customerAddress: 'No. 18, 21st street, Annanagar East, Chennai',
        deliveryAddress: 'No. 18, 21st street, Annanagar East, Chennai',
        gstin: '33AABCU9603R1ZX',
        deliveryDate: '2026-09-30',
        items: [
          { productName: 'Hikvision 4MP IP Dome Camera', quantity: 15, unit: 'Piece', hsnSac: '85258090' }
        ]
      };

      // Import the modules in browser
      const formatters = await import('/src/components/documents/documentFormatters.js');
      const companyConfig = await import('/src/components/documents/companyConfig.jsx');
      const dcModule = await import('/src/components/documents/PrintableDeliveryChallan.jsx');

      // Test normalizePartyLines
      const normConsignee = formatters.normalizePartyLines(dcData.customerName, dcData.company);
      const normDispatch = formatters.normalizePartyLines(dcData.receiverName, dcData.company);

      // Mount the component to test live rendering
      const React = await import('react');
      const ReactDOM = await import('react-dom/client');

      let mountNode = document.getElementById('test-dc-mount-node');
      if (!mountNode) {
        mountNode = document.createElement('div');
        mountNode.id = 'test-dc-mount-node';
        mountNode.style.padding = '20px';
        mountNode.style.background = '#f1f5f9';
        mountNode.style.minHeight = '100vh';
        document.body.appendChild(mountNode);
      }

      const root = ReactDOM.createRoot(mountNode);
      root.render(React.createElement(dcModule.default, { data: dcData }));

      // Wait a moment for render
      await new Promise((res) => setTimeout(res, 500));

      // Query the rendered party lines
      const consigneeCell = mountNode.querySelector('.dc-parties-row.dc-parties-client-row .dc-parties-cell:nth-child(1)');
      const dispatchCell = mountNode.querySelector('.dc-parties-row.dc-parties-client-row .dc-parties-cell:nth-child(2)');
      const logoImg = mountNode.querySelector('.dc-doc-company-logo');

      const consigneeText = consigneeCell ? consigneeCell.innerText : '';
      const dispatchText = dispatchCell ? dispatchCell.innerText : '';
      const logoSrc = logoImg ? logoImg.getAttribute('src') : '';

      return {
        normConsignee,
        normDispatch,
        consigneeText,
        dispatchText,
        logoSrcHasMaster: Boolean(logoSrc && (logoSrc.startsWith('data:image') || logoSrc.includes('asi'))),
        logoSrc: logoSrc ? logoSrc.slice(0, 50) + '...' : null
      };
    });

    console.log('Browser Render Result:', result);

    // Verify Consignee: Contains "RK & Sons — Gomathi", does NOT have Gomathi twice
    const consigneeLines = result.consigneeText.split('\n').map((s) => s.trim()).filter(Boolean);
    console.log('Consignee Rendered Lines:', consigneeLines);

    // Verify Dispatched To: Contains single "Gomathi", does NOT have Gomathi twice
    const dispatchLines = result.dispatchText.split('\n').map((s) => s.trim()).filter(Boolean);
    console.log('Delivered / Dispatched To Rendered Lines:', dispatchLines);

    // Count occurrences of "Gomathi" in Consignee
    const gomathiInConsignee = consigneeLines.filter((l) => l.toLowerCase() === 'gomathi').length;
    console.log('Occurrences of standalone "Gomathi" in Consignee (should be 0):', gomathiInConsignee);
    if (gomathiInConsignee > 0) {
      throw new Error(`Consignee has ${gomathiInConsignee} standalone "Gomathi" lines! Duplicate not removed!`);
    }

    // Count occurrences of "Gomathi" in Delivered / Dispatched To
    const gomathiInDispatch = dispatchLines.filter((l) => l.toLowerCase() === 'gomathi').length;
    console.log('Occurrences of standalone "Gomathi" in Delivered / Dispatched To (must be exactly 1):', gomathiInDispatch);
    if (gomathiInDispatch !== 1) {
      throw new Error(`Delivered / Dispatched To has ${gomathiInDispatch} "Gomathi" lines! Expected exactly 1!`);
    }

    // Take screenshot of the rendered Delivery Challan
    const screenshotPath = path.join(ARTIFACTS_DIR, 'verify_dc_customer_dedup_master_branding.png');
    const dcSheet = await page.$('.printable-delivery-challan');
    if (dcSheet) {
      await dcSheet.screenshot({ path: screenshotPath });
      console.log('Saved screenshot to:', screenshotPath);
    } else {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('Saved fullpage screenshot to:', screenshotPath);
    }

    console.log('✓ All Browser UI Verifications Succeeded!');
  } finally {
    await browser.close();
  }
}

test().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
