const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testDynamicSerials() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('1. Navigating to DC create page...');
  await page.goto('http://localhost:5173/#/delivery-challans/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take initial screenshot
  const artifactDir = path.resolve(__dirname, '..');
  const shot1 = path.join(artifactDir, 'test_dc_sn_initial.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log('Saved shot1:', shot1);

  // Let's check the product select or quotation dropdown
  // Check if there are quotation dropdown options or product select
  console.log('2. Selecting first product in table...');
  // The first row has a SearchableProductSelect
  const productSelect = page.locator('.dc-table tbody tr').first().locator('.crm-product-select-header, input[type="text"]').first();
  if (await productSelect.isVisible()) {
    await productSelect.click();
    await page.waitForTimeout(500);

    // Click the first product in the dropdown list
    const firstOption = page.locator('.crm-product-dropdown-item, .crm-autocomplete-item').first();
    if (await firstOption.isVisible()) {
      const optText = await firstOption.innerText();
      console.log('Selecting product option:', optText);
      await firstOption.click();
      await page.waitForTimeout(1000);
    }
  }

  // Check the SN button on the first populated row
  const snButton = page.locator('.dc-sn-btn').first();
  if (await snButton.isVisible()) {
    const snText1 = await snButton.innerText();
    console.log('SN Button Text with Qty 1:', snText1);

    const shot2 = path.join(artifactDir, 'test_dc_sn_qty1.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log('Saved shot2:', shot2);

    // Now change delivery qty to 2
    console.log('3. Changing delivery qty to 2...');
    const qtyInput = page.locator('.dc-qty-input').first();
    await qtyInput.fill('2');
    await page.waitForTimeout(500);

    const snText2 = await snButton.innerText();
    console.log('SN Button Text with Qty 2:', snText2);

    const shot3 = path.join(artifactDir, 'test_dc_sn_qty2.png');
    await page.screenshot({ path: shot3, fullPage: true });
    console.log('Saved shot3:', shot3);

    // Now change delivery qty to 5
    console.log('4. Changing delivery qty to 5...');
    await qtyInput.fill('5');
    await page.waitForTimeout(500);

    const snText5 = await snButton.innerText();
    console.log('SN Button Text with Qty 5:', snText5);

    const shot4 = path.join(artifactDir, 'test_dc_sn_qty5.png');
    await page.screenshot({ path: shot4, fullPage: true });
    console.log('Saved shot4:', shot4);
  } else {
    console.log('SN button not visible yet, checking rows...');
  }

  await browser.close();
  console.log('Done testDynamicSerials.');
}

testDynamicSerials().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
