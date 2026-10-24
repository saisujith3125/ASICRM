const puppeteer = require('../node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function runTest() {
  console.log('=== STARTING PARTIAL DC & REF NO VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // 1. Log in or setup authentication in localStorage
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
  await page.goto('https://crmapi.asiind.com/delivery-challans/new', { waitUntil: 'networkidle2' });

  console.log('On page:', page.url());
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Select Customer from dropdown
  console.log('Selecting customer from dropdown...');
  const customerInput = await page.$('.dc-group-dispatch-to input.sps-direct-input');
  if (!customerInput) throw new Error('Customer input not found');
  await customerInput.click();
  await new Promise((r) => setTimeout(r, 600));

  const customerOptions = await page.$$('.scs-dropdown-list.is-dc-customer li.scs-option-item');
  console.log('Customer options count:', customerOptions.length);
  if (customerOptions.length === 0) throw new Error('No customer options found');
  await customerOptions[0].click();
  await new Promise((r) => setTimeout(r, 800));

  // Reset quotation to manual entry (-- No Quotation (Manual Entry) --) to test DC from scratch
  const quoteSelect = await page.$('.dc-group-quotation select');
  if (quoteSelect) {
    await quoteSelect.select('');
    await new Promise((r) => setTimeout(r, 600));
  }

  await new Promise((r) => setTimeout(r, 1000));

  // 3. Inspect Table Headers - Verify REQ QTY column is present
  const headers = await page.$$eval('.delivery-items-table thead th', ths => ths.map(th => th.innerText.trim()));
  console.log('Table Headers:', headers);
  if (!headers.includes('REQ QTY')) {
    throw new Error('REQ QTY column missing in table header! Headers: ' + JSON.stringify(headers));
  }
  console.log('✓ Verified REQ QTY column header exists!');

  // 4. Select a Product in first row
  console.log('Selecting product in row 1...');
  const productSelectTrigger = await page.$('.dc-item-selection-cell .sps-input-trigger-wrapper');
  if (!productSelectTrigger) throw new Error('Product select trigger not found');
  await productSelectTrigger.click();
  await new Promise((r) => setTimeout(r, 600));

  const productOptions = await page.$$('.sps-options-list li.sps-option-item, .sps-option-item');
  console.log('Product options count:', productOptions.length);
  if (productOptions.length === 0) throw new Error('No product options in dropdown');
  await productOptions[0].click();
  await new Promise((r) => setTimeout(r, 800));

  // 5. Check Available Qty
  const availText = await page.$eval('.dc-entry-row .dc-avail-badge', el => el.innerText.trim());
  console.log('Available quantity for selected product:', availText);

  // 6. Set REQ QTY = 4 and DELIVERY QTY = 2 (Partial Delivery from Scratch)
  console.log('Setting REQ QTY = 4 and DELIVERY QTY = 2...');
  const inputs = await page.$$('.dc-entry-row input.dc-qty-input');
  // inputs[0] is REQ QTY, inputs[1] is DELIVERY QTY
  if (inputs.length < 2) throw new Error('Expected 2 qty inputs (REQ QTY and DELIVERY QTY), found ' + inputs.length);

  const reqQtyInput = inputs[0];
  const deliveryQtyInput = inputs[1];

  // Clear and type REQ QTY = 4
  await reqQtyInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await reqQtyInput.type('4');
  await new Promise((r) => setTimeout(r, 300));

  // Clear and type DELIVERY QTY = 2
  await deliveryQtyInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await deliveryQtyInput.type('2');
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot the populated form with REQ QTY = 4 and DELIVERY QTY = 2
  const scratchPic = path.join(ARTIFACTS_DIR, 'test_dc_scratch_partial_qty.png');
  await page.screenshot({ path: scratchPic, fullPage: true });
  console.log('Saved screenshot:', scratchPic);

  // 7. Click Create / Generate DC
  console.log('Submitting DC...');
  const submitBtn = await page.$('button[type="submit"].crm-btn-primary');
  if (!submitBtn) throw new Error('Submit button not found');
  await submitBtn.click();
  await new Promise((r) => setTimeout(r, 2000));

  // Verify created DC from backend API
  const res = await fetch('https://crmapi.asiind.com/api/orders/delivery-challans', {
    headers: { 'x-user-id': 'USR-001' }
  });
  const resJson = await res.json();
  const backendCheck = resJson.data;

  const latestDc = backendCheck[0];
  console.log('Latest DC created:', {
    challanId: latestDc.challanId,
    deliveryStatus: latestDc.deliveryStatus,
    remainingAfterThisDC: latestDc.remainingAfterThisDC,
    items: latestDc.items?.map(it => ({
      name: it.productName,
      reqQty: it.requiredQty,
      delivQty: it.quantity,
      remQty: it.remainingAfterThisDC,
      status: it.status
    }))
  });

  if (latestDc.deliveryStatus !== 'PARTIAL') {
    throw new Error('Expected latest DC to be PARTIAL, got: ' + latestDc.deliveryStatus);
  }
  if (Number(latestDc.remainingAfterThisDC) !== 2) {
    throw new Error('Expected remainingAfterThisDC to be 2, got: ' + latestDc.remainingAfterThisDC);
  }
  console.log('✓ Successfully created partial DC with 2 units remaining balance!');

  // 8. Test "Ref No / Pending DC" connection
  console.log('\n--- TESTING REF NO / PENDING DC DROPDOWN ---');
  await page.goto('https://crmapi.asiind.com/delivery-challans/new', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  // Check the Ref No dropdown before selecting customer
  const refNoTrigger = await page.$('.dc-group-ref-no .sps-input-trigger-wrapper');
  await refNoTrigger.click();
  await new Promise((r) => setTimeout(r, 600));

  const pendingItemsInDropdown = await page.$$eval('.scs-dropdown-list.is-dc-refno li.scs-option-item', items =>
    items.map(it => it.innerText.replace(/\s+/g, ' ').trim())
  );
  console.log('Pending DCs in dropdown (unfiltered):', pendingItemsInDropdown.length);
  const foundOurDc = pendingItemsInDropdown.some(t => t.includes(latestDc.challanId) && t.includes('2 unit'));
  console.log('Found our partial DC in dropdown?', foundOurDc);

  if (!foundOurDc) {
    throw new Error('Our created partial DC ' + latestDc.challanId + ' was not found in Ref No dropdown!');
  }
  console.log('✓ Partial DC appears in Ref No / Pending DC combobox!');

  // 9. Select our partial DC from the dropdown
  console.log('Selecting our partial DC ' + latestDc.challanId + '...');
  const targetOption = await page.evaluateHandle((cid) => {
    const list = Array.from(document.querySelectorAll('.scs-dropdown-list.is-dc-refno li.scs-option-item'));
    return list.find(el => el.innerText.includes(cid));
  }, latestDc.challanId);

  if (!targetOption) throw new Error('Could not find option handle for ' + latestDc.challanId);
  await targetOption.click();
  await new Promise((r) => setTimeout(r, 1200));

  // 10. Verify auto-populated state
  const populatedRefNo = await page.$eval('.dc-group-ref-no input.sps-direct-input', el => el.value);
  const populatedCust = await page.$eval('.dc-group-dispatch-to input.sps-direct-input', el => el.value);
  console.log('Populated Ref No:', populatedRefNo);
  console.log('Populated Customer:', populatedCust);

  if (!populatedRefNo.includes(latestDc.challanId)) {
    throw new Error('Expected Ref No to contain ' + latestDc.challanId + ', got: ' + populatedRefNo);
  }

  // Check table rows: REQ QTY and DELIVERY QTY should both be 2, locked
  const rowDetails = await page.evaluate(() => {
    const row = document.querySelector('.delivery-items-table .dc-entry-row');
    if (!row) return null;
    const inputs = Array.from(row.querySelectorAll('input.dc-qty-input'));
    const pendingBalBadge = row.querySelector('div[style*="PENDING BAL"]');
    return {
      reqVal: inputs[0]?.value,
      reqReadOnly: inputs[0]?.hasAttribute('readonly'),
      reqDisabled: inputs[0]?.disabled,
      delivVal: inputs[1]?.value,
      delivReadOnly: inputs[1]?.hasAttribute('readonly'),
      hasPendingBalBadge: Boolean(row.innerText.includes('PENDING BAL'))
    };
  });
  console.log('Pending DC row state in table:', rowDetails);

  if (rowDetails.reqVal !== '2' || !rowDetails.reqReadOnly) {
    throw new Error('Expected REQ QTY to be locked to 2, got: ' + JSON.stringify(rowDetails));
  }
  if (rowDetails.delivVal !== '2' || !rowDetails.delivReadOnly) {
    throw new Error('Expected DELIVERY QTY to be locked to 2, got: ' + JSON.stringify(rowDetails));
  }
  console.log('✓ Pending DC items table perfectly loaded with locked remaining balance of 2 units!');

  // Take screenshot of pending DC loaded
  const pendingLoadedPic = path.join(ARTIFACTS_DIR, 'test_dc_pending_selected_autopopulated.png');
  await page.screenshot({ path: pendingLoadedPic, fullPage: true });
  console.log('Saved screenshot:', pendingLoadedPic);

  // 11. Submit the fulfilling DC
  console.log('Submitting second DC to fulfill remaining balance...');
  const submitBtn2 = await page.$('button[type="submit"].crm-btn-primary');
  await submitBtn2.click();
  await new Promise((r) => setTimeout(r, 2000));

  // Verify backend state of parent and child DCs
  const res2 = await fetch('https://crmapi.asiind.com/api/orders/delivery-challans', {
    headers: { 'x-user-id': 'USR-001' }
  });
  const res2Json = await res2.json();
  const parent = res2Json.data.find(d => d.challanId === latestDc.challanId);
  const fulfilling = res2Json.data[0];
  const finalCheck = { parent, fulfilling };

  console.log('Fulfilling DC:', {
    challanId: finalCheck.fulfilling.challanId,
    refNo: finalCheck.fulfilling.refNo,
    deliveryStatus: finalCheck.fulfilling.deliveryStatus,
    remainingAfterThisDC: finalCheck.fulfilling.remainingAfterThisDC
  });

  console.log('Parent DC after fulfillment:', {
    challanId: finalCheck.parent.challanId,
    deliveryStatus: finalCheck.parent.deliveryStatus,
    remainingAfterThisDC: finalCheck.parent.remainingAfterThisDC
  });

  if (finalCheck.parent.deliveryStatus !== 'COMPLETE' || Number(finalCheck.parent.remainingAfterThisDC) !== 0) {
    throw new Error('Expected parent DC to be COMPLETE with remaining 0, got: ' + JSON.stringify(finalCheck.parent));
  }

  console.log('✓ Parent DC successfully transitioned to COMPLETE (0 pending)!');
  console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');

  await browser.close();
}

runTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
