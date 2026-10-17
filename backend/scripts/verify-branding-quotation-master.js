const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1x1 transparent red pixel base64 test image
const TEST_BRAND_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAMklEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeBjIAAAGFsmQGAAAAAElFTkSuQmCC';
const TEST_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAARElEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4GwwOAABhS62vwAAAABJRU5ErkJggg==';
const TEST_SEAL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAPElEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4M3V4AAEa7Bv1AAAAAElFTkSuQmCC';

async function runMasterBrandingAndQuotationE2ETest() {
  console.log('================================================================');
  console.log('🚀 MASTER E2E: COMPANY BRANDING & QUOTATION VISUAL ARCHITECTURE');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

  try {
    // Step 1: Login / Auth Setup
    console.log('[STEP 1] Setting authenticated session...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*']
      }));
    });

    // Step 2: Update Settings via backend API with test branding assets and ISO certification
    console.log('[STEP 2] Updating Settings Company Profile and Branding...');
    const updateRes = await page.evaluate(async (logo, sig, seal) => {
      const token = 'USR-001';
      const payload = {
        name: 'Active System Integration',
        iso: 'ISO 9001:2015 & ISO 27001 Certified',
        street: 'Plot No. 10A, Perumal Kovil Street',
        street2: 'Sivabootham, Vanagaram',
        city: 'Chennai',
        pincode: '600095',
        state: 'Tamil Nadu',
        country: 'India',
        phone: '09994126666',
        mobile: '98943 26666, 91500 26666, 91711 26666',
        email: 'admin@asi.ind.in',
        logoUrl: logo,
        signatureUrl: sig,
        sealUrl: seal
      };

      const res = await fetch('http://127.0.0.1:5000/api/settings/company', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': token
        },
        body: JSON.stringify(payload)
      });
      return await res.json();
    }, TEST_BRAND_LOGO, TEST_SIGNATURE, TEST_SEAL);

    console.log('✓ Settings update response:', updateRes.success ? 'SUCCESS' : updateRes.message);
    if (!updateRes.success) throw new Error('Failed to update company branding via API');

    // Step 3: Verify Persistence by re-fetching from backend
    console.log('[STEP 3] Verifying backend persistence of ISO, logoUrl, signatureUrl, sealUrl...');
    const verifyRes = await page.evaluate(async () => {
      const res = await fetch('http://127.0.0.1:5000/api/settings/company', {
        headers: { 'x-user-id': 'USR-001' }
      });
      return await res.json();
    });

    const companyData = verifyRes.data || {};
    console.log(`✓ Stored ISO: "${companyData.iso}"`);
    console.log(`✓ Stored logoUrl present: ${Boolean(companyData.logoUrl)}`);
    console.log(`✓ Stored signatureUrl present: ${Boolean(companyData.signatureUrl)}`);
    console.log(`✓ Stored sealUrl present: ${Boolean(companyData.sealUrl)}`);

    if (companyData.iso !== 'ISO 9001:2015 & ISO 27001 Certified') {
      throw new Error(`ISO not persisted correctly. Found: "${companyData.iso}"`);
    }
    if (!companyData.logoUrl || !companyData.signatureUrl || !companyData.sealUrl) {
      throw new Error('Branding URLs not persisted completely');
    }

    // Step 4: Open Quotation Creator / Editor
    console.log('[STEP 4] Opening Quotation Editor...');
    await page.goto('http://localhost:5173/quotations/new', { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Select customer
    const custInput = await page.$('.customer-selector-container input, .scs-input');
    if (custInput) {
      await custInput.click();
      await sleep(400);
      const custOption = await page.$('.scs-option-item, .customer-option');
      if (custOption) await custOption.click();
      await sleep(500);
    }

    // Select product
    const firstProductSelect = await page.$('.quotation-items-table tbody tr:first-child input.sps-direct-input');
    if (firstProductSelect) {
      await firstProductSelect.click();
      await page.keyboard.type('Dahua 5MP');
      await sleep(600);
      const opt = await page.$('.sps-dropdown-portal li.sps-option-item, li.sps-option-item');
      if (opt) await opt.click();
      else await page.keyboard.press('Enter');
      await sleep(600);
    }

    // Step 5: Open Quotation PDF / Print Preview Modal
    console.log('[STEP 5] Opening Quotation Print Preview Modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.textContent.includes('Quotation PDF') || b.textContent.includes('Preview'));
      if (btn) btn.click();
    });
    await sleep(1500);

    // Step 6: Validate Header Logo, ISO, Company Info in Preview
    console.log('[STEP 6] Validating Preview rendered Central Branding...');
    const previewHeader = await page.evaluate(() => {
      const root = document.querySelector('.doc-quotation-root');
      if (!root) return { found: false };

      const logoImg = root.querySelector('.quotation-header-logo-img');
      const isoEl = root.querySelector('.quotation-company-iso');
      const companyNameEl = root.querySelector('.quotation-company-name');
      const sigImg = root.querySelector('.quotation-sig-img');
      const sealImg = root.querySelector('.quotation-seal-img');
      const toHeading = root.querySelector('.quotation-to-heading');
      const subLine = root.querySelector('.quotation-subject-line');
      const intro = root.querySelector('.quotation-intro-paragraph');
      const table = root.querySelector('.quotation-table');
      const amountWords = root.querySelector('.quotation-amount-words');

      return {
        found: true,
        hasCustomLogo: Boolean(logoImg && logoImg.src && logoImg.src.startsWith('data:image/png')),
        isoText: isoEl ? isoEl.textContent.trim() : null,
        companyName: companyNameEl ? companyNameEl.textContent.trim() : null,
        hasCustomSig: Boolean(sigImg && sigImg.src && sigImg.src.startsWith('data:image/png')),
        hasCustomSeal: Boolean(sealImg && sealImg.src && sealImg.src.startsWith('data:image/png')),
        hasToHeading: Boolean(toHeading),
        hasSubLine: Boolean(subLine),
        hasIntro: Boolean(intro),
        hasItemsTable: Boolean(table),
        hasAmountWords: Boolean(amountWords)
      };
    });

    console.log('✓ Preview Inspection Results:');
    console.log('  - Document Root Found:', previewHeader.found);
    console.log('  - Custom Header Logo Rendered:', previewHeader.hasCustomLogo);
    console.log('  - Dynamic ISO Rendered:', previewHeader.isoText);
    console.log('  - Company Name Rendered:', previewHeader.companyName);
    console.log('  - Custom Digital Signature Rendered:', previewHeader.hasCustomSig);
    console.log('  - Custom Official Seal Rendered:', previewHeader.hasCustomSeal);
    console.log('  - "To," Customer Block:', previewHeader.hasToHeading);
    console.log('  - Subject Line (SUB : ...):', previewHeader.hasSubLine);
    console.log('  - Covering Letter Intro:', previewHeader.hasIntro);
    console.log('  - Commercial Items Table:', previewHeader.hasItemsTable);
    console.log('  - Number in Words:', previewHeader.hasAmountWords);

    if (!previewHeader.found) throw new Error('Quotation preview document root not found');
    if (!previewHeader.hasCustomLogo) throw new Error('Quotation preview did not render uploaded custom logoUrl');
    if (!previewHeader.isoText?.includes('ISO 9001:2015 & ISO 27001 Certified')) {
      throw new Error(`Quotation preview did not render updated ISO certification. Got: ${previewHeader.isoText}`);
    }
    if (!previewHeader.hasCustomSig) throw new Error('Quotation preview did not render uploaded custom signatureUrl');
    if (!previewHeader.hasCustomSeal) throw new Error('Quotation preview did not render uploaded custom sealUrl');

    // Step 7: Capture Visual Evidence Artifacts
    console.log('[STEP 7] Capturing visual evidence screenshots...');
    const modalShot = path.join(ARTIFACTS_DIR, 'verify_branding_quotation_preview.png');
    await page.screenshot({ path: modalShot, fullPage: false });
    console.log(`✓ Screenshot captured: ${modalShot}`);

    // Scroll to page 2 (Commercial items, totals, signoff)
    await page.evaluate(() => {
      const page2 = document.querySelectorAll('.doc-quotation-page')[1];
      if (page2) page2.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await sleep(600);
    const page2Shot = path.join(ARTIFACTS_DIR, 'verify_branding_quotation_page2.png');
    await page.screenshot({ path: page2Shot, fullPage: false });
    console.log(`✓ Page 2 Screenshot captured: ${page2Shot}`);

    console.log('================================================================');
    console.log('🎉 ALL BRANDING & QUOTATION VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err.message);
    const errShot = path.join(ARTIFACTS_DIR, 'verify_branding_error.png');
    await page.screenshot({ path: errShot, fullPage: true }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runMasterBrandingAndQuotationE2ETest();
