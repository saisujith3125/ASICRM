import assert from 'node:assert';
import path from 'node:path';
import { createServer } from 'vite';

async function run() {
  const server = await createServer({
    root: path.resolve('frontend'),
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    const {
      normalizePartyLines,
      cleanSemanticString,
      extractSemanticParts
    } = await server.ssrLoadModule('/src/components/documents/documentFormatters.js');

    const {
      normalizeDeliveryChallanDocument
    } = await server.ssrLoadModule('/src/components/documents/PrintableDeliveryChallan.jsx');

    const {
      DEFAULT_ASI_LOGO
    } = await server.ssrLoadModule('/src/components/documents/companyConfig.jsx');

    console.log('=== RUNNING COMPREHENSIVE PARTY DEDUPLICATION & MASTER BRANDING TESTS ===');

    // 1. UNIT TESTS: All 6 Business Rule Examples from Prompt
    console.log('\n--- 1. Testing Exact 6 Examples from Prompt ---');

    // Case 1: Primary: RK & Sons — Gomathi, Secondary: Gomathi -> Render: RK & Sons — Gomathi
    const c1 = normalizePartyLines('RK & Sons — Gomathi', 'Gomathi');
    console.log('Case 1:', c1);
    assert.strictEqual(c1.primaryLine, 'RK & Sons — Gomathi');
    assert.strictEqual(c1.secondaryLine, null);
    assert.strictEqual(c1.isDuplicate, true);

    // Case 2: Primary: RK & Sons, Secondary: Gomathi -> Render: RK & Sons, Gomathi
    const c2 = normalizePartyLines('RK & Sons', 'Gomathi');
    console.log('Case 2:', c2);
    assert.strictEqual(c2.primaryLine, 'RK & Sons');
    assert.strictEqual(c2.secondaryLine, 'Gomathi');
    assert.strictEqual(c2.isDuplicate, false);

    // Case 3: Primary: Gomathi, Secondary: Gomathi -> Render: Gomathi
    const c3 = normalizePartyLines('Gomathi', 'Gomathi');
    console.log('Case 3:', c3);
    assert.strictEqual(c3.primaryLine, 'Gomathi');
    assert.strictEqual(c3.secondaryLine, null);
    assert.strictEqual(c3.isDuplicate, true);

    // Case 4: Primary: RK & Sons — Gomathi, Secondary: Priya -> Render: RK & Sons — Gomathi, Priya
    const c4 = normalizePartyLines('RK & Sons — Gomathi', 'Priya');
    console.log('Case 4:', c4);
    assert.strictEqual(c4.primaryLine, 'RK & Sons — Gomathi');
    assert.strictEqual(c4.secondaryLine, 'Priya');
    assert.strictEqual(c4.isDuplicate, false);

    // Case 5: Primary: RK & Sons, Secondary: RK & Sons -> Render: RK & Sons
    const c5 = normalizePartyLines('RK & Sons', 'RK & Sons');
    console.log('Case 5:', c5);
    assert.strictEqual(c5.primaryLine, 'RK & Sons');
    assert.strictEqual(c5.secondaryLine, null);
    assert.strictEqual(c5.isDuplicate, true);

    // Case 6: Primary: Gomathi, Secondary: empty -> Render: Gomathi
    const c6 = normalizePartyLines('Gomathi', '');
    console.log('Case 6:', c6);
    assert.strictEqual(c6.primaryLine, 'Gomathi');
    assert.strictEqual(c6.secondaryLine, null);
    assert.strictEqual(c6.isDuplicate, false);

    console.log('✓ All 6 Business Rule Examples Passed Perfectly!');

    // 2. ADDITIONAL DELIMITER & FORMATTING TESTS
    console.log('\n--- 2. Testing Variations of Delimiters & Formats ---');

    // Hyphen with spaces
    const c7 = normalizePartyLines('RK & Sons - Gomathi', 'Gomathi');
    assert.strictEqual(c7.primaryLine, 'RK & Sons - Gomathi');
    assert.strictEqual(c7.secondaryLine, null);

    // Parentheses
    const c8 = normalizePartyLines('RK & Sons (Gomathi)', 'Gomathi');
    assert.strictEqual(c8.primaryLine, 'RK & Sons (Gomathi)');
    assert.strictEqual(c8.secondaryLine, null);

    // Slash delimiter
    const c9 = normalizePartyLines('RK & Sons / Gomathi', 'Gomathi');
    assert.strictEqual(c9.primaryLine, 'RK & Sons / Gomathi');
    assert.strictEqual(c9.secondaryLine, null);

    // Case insensitivity
    const c10 = normalizePartyLines('RK & Sons — GOMATHI', 'gomathi');
    assert.strictEqual(c10.primaryLine, 'RK & Sons — GOMATHI');
    assert.strictEqual(c10.secondaryLine, null);

    console.log('✓ Delimiter & Case Variations Passed Perfectly!');

    // 3. DELIVERY CHALLAN DOCUMENT VIEW MODEL TESTS
    console.log('\n--- 3. Testing Delivery Challan View Model ---');

    // Simulated DC with Issue A & B (Gomathi duplication)
    const testDcDuplicated = {
      challanId: 'DC-000120',
      customerName: 'RK & Sons — Gomathi',
      company: 'Gomathi',
      receiverName: 'Gomathi',
      customerAddress: 'No. 18, 21st street, Annanagar East, Chennai',
      deliveryAddress: 'No. 18, 21st street, Annanagar East, Chennai',
      gstin: '33AABCU9603R1ZX'
    };

    const docViewModelA = normalizeDeliveryChallanDocument(testDcDuplicated);
    console.log('Issue A & B DC Consignee:', docViewModelA.consignee);
    console.log('Issue A & B DC Dispatch:', docViewModelA.dispatch);

    // Check Consignee: Must NOT have second Gomathi
    assert.strictEqual(docViewModelA.consignee.primaryLine, 'RK & Sons — Gomathi');
    assert.strictEqual(docViewModelA.consignee.secondaryLine, null);
    assert.strictEqual(docViewModelA.consignee.address, 'No. 18, 21st street, Annanagar East, Chennai');

    // Check Delivered / Dispatched To: Must NOT have second Gomathi
    assert.strictEqual(docViewModelA.dispatch.primaryLine, 'Gomathi');
    assert.strictEqual(docViewModelA.dispatch.secondaryLine, null);
    assert.strictEqual(docViewModelA.dispatch.address, 'No. 18, 21st street, Annanagar East, Chennai');

    console.log('✓ Delivery Challan Consignee & Dispatch Deduplication Passed!');

    // Genuinely distinct delivery contact test
    const testDcDistinct = {
      challanId: 'DC-000121',
      customerName: 'RK & Sons — Gomathi',
      company: 'RK & Sons',
      receiverName: 'Priya',
      customerAddress: 'No. 18, 21st street, Annanagar East, Chennai',
      deliveryAddress: 'Site Office, Ambattur Industrial Estate, Chennai'
    };

    const docViewModelB = normalizeDeliveryChallanDocument(testDcDistinct);
    console.log('Distinct Contact DC Consignee:', docViewModelB.consignee);
    console.log('Distinct Contact DC Dispatch:', docViewModelB.dispatch);

    assert.strictEqual(docViewModelB.consignee.primaryLine, 'RK & Sons — Gomathi');
    assert.strictEqual(docViewModelB.consignee.secondaryLine, null);
    assert.strictEqual(docViewModelB.dispatch.primaryLine, 'Priya');
    assert.strictEqual(docViewModelB.dispatch.secondaryLine, 'RK & Sons');
    console.log('✓ Distinct Delivery Contact Preservation Passed!');

    // 4. MASTER LOGO PROPAGATION TESTS
    console.log('\n--- 4. Testing Master Logo Propagation ---');

    // Default Master Logo
    const defaultDoc = normalizeDeliveryChallanDocument(testDcDuplicated);
    assert.ok(defaultDoc.comp.logoUrl, 'Default logoUrl should be present');
    console.log('Default DC Logo URL prefix:', defaultDoc.comp.logoUrl.slice(0, 30) + '...');

    // Custom Uploaded Master Logo in settings
    const customLogoSvg = 'data:image/svg+xml;base64,PHN2Zz5jdXN0b20tbG9nbzwvc3ZnPg==';
    const customDoc = normalizeDeliveryChallanDocument(testDcDuplicated, {
      logoUrl: customLogoSvg,
      name: 'Custom Brand Enterprise'
    });

    assert.strictEqual(customDoc.comp.logoUrl, customLogoSvg);
    assert.strictEqual(customDoc.comp.name, 'Custom Brand Enterprise');
    console.log('✓ Custom Master Logo Successfully Propagated to Delivery Challan!');

    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY! ===\n');
  } finally {
    await server.close();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
