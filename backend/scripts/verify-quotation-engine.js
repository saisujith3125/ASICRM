const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const headers = {
  'Content-Type': 'application/json',
  'x-user-id': 'USR-001',
  'x-user-role': 'SUPER_ADMIN'
};

async function runTests() {
  console.log('--- STARTING QUOTATION ENGINE BACKEND TESTS ---');

  // Test 1: Fetch stock products and verify descriptions
  console.log('\n[TEST 1] Verifying stock products descriptions in catalog...');
  const stocksRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/stocks',
    method: 'GET',
    headers
  });

  const products = stocksRes.data?.data?.products || stocksRes.data?.data || [];
  console.log(`Found ${products.length} products.`);

  const prod1 = products.find((p) => (p.id || p.productId) === 'PROD-000001' || p.code === 'PROD-000001');
  const prod4 = products.find((p) => (p.id || p.productId) === 'PROD-000004' || p.code === 'PROD-000004');

  if (!prod1 || !prod1.description) {
    throw new Error(`TEST 1 FAILED: PROD-000001 does not have description. Got: ${JSON.stringify(prod1)}`);
  }
  console.log(`✓ PROD-000001 description: "${prod1.description}"`);

  if (!prod4 || prod4.description) {
    throw new Error(`TEST 1 FAILED: PROD-000004 should have empty description. Got: "${prod4?.description}"`);
  }
  console.log(`✓ PROD-000004 description is empty string: "${prod4.description || ''}"`);

  // Test 2: Create customer to use for quotation
  console.log('\n[TEST 2] Ensuring customer exists...');
  const custRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/customers',
    method: 'GET',
    headers
  });
  const customers = custRes.data?.data || [];
  let testCustomerId = customers[0]?.id || customers[0]?.customerId;
  if (!testCustomerId) {
    const newCust = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/customers',
      method: 'POST',
      headers
    }, {
      name: 'Quotation Test Consignee',
      company: 'ASI Test Corp',
      mobile: '9876543210',
      email: 'test@asi.ind.in',
      city: 'Chennai',
      state: 'Tamil Nadu'
    });
    testCustomerId = newCust.data?.data?.id || newCust.data?.data?.customerId;
  }
  console.log(`✓ Using Customer ID: ${testCustomerId}`);

  // Test 3: Reject duplicate products
  console.log('\n[TEST 3] Testing duplicate product rejection...');
  const dupRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/enquiries/quotations',
    method: 'POST',
    headers
  }, {
    customerId: testCustomerId,
    items: [
      { productId: 'PROD-000001', quantity: 1, unitPrice: 5500, gst: 18 },
      { productId: 'PROD-000001', quantity: 2, unitPrice: 5500, gst: 18 }
    ],
    validUntil: '2026-10-30',
    remarks: 'Duplicate test'
  });
  if (dupRes.status === 400 && dupRes.data?.message?.includes('already added')) {
    console.log(`✓ Duplicate product rejected as expected: "${dupRes.data.message}"`);
  } else {
    throw new Error(`TEST 3 FAILED: Duplicate should be rejected. Response: ${JSON.stringify(dupRes)}`);
  }

  // Test 4: Reject unit price below min price
  console.log('\n[TEST 4] Testing min price enforcement...');
  const minPriceProd = prod1.dealerPrice || prod1.price || 4850;
  const underPriceRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/enquiries/quotations',
    method: 'POST',
    headers
  }, {
    customerId: testCustomerId,
    items: [
      { productId: 'PROD-000001', minPrice: minPriceProd, quantity: 1, unitPrice: minPriceProd - 500, gst: 18 }
    ],
    validUntil: '2026-10-30',
    remarks: 'Underprice test'
  });
  if (underPriceRes.status === 400 && underPriceRes.data?.message?.includes('Price')) {
    console.log(`✓ Under-minimum price rejected as expected: "${underPriceRes.data.message}"`);
  } else {
    throw new Error(`TEST 4 FAILED: Underprice should be rejected. Response: ${JSON.stringify(underPriceRes)}`);
  }

  // Test 5: Successful creation with Discount and Round-Off
  console.log('\n[TEST 5] Testing valid quotation with Discount and Round-Off...');
  const validQuoteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/enquiries/quotations',
    method: 'POST',
    headers
  }, {
    customerId: testCustomerId,
    items: [
      {
        productId: 'PROD-000001',
        description: 'Quotation-specific customized camera with waterproof hood.',
        quantity: 2,
        unitPrice: 5000, // dealer price is 4850
        discount: 10,
        gst: 18
      },
      {
        productId: 'PROD-000002',
        description: 'Indoor CP Plus camera with standard lens.',
        quantity: 1,
        unitPrice: 3500.50, // dealer price is 3150
        discount: 5,
        gst: 18
      }
    ],
    showDiscount: true,
    roundOffTotal: true,
    validUntil: '2026-10-30',
    remarks: 'Custom quotation with 10% and 5% discounts'
  });

  if (validQuoteRes.status !== 200 && validQuoteRes.status !== 201) {
    throw new Error(`TEST 5 FAILED: Failed to create quotation. Status: ${validQuoteRes.status}, data: ${JSON.stringify(validQuoteRes.data)}`);
  }

  const quote = validQuoteRes.data.data;
  console.log(`✓ Created Quotation #${quote.quotationId || quote.quotationNumber}`);
  console.log(`  Subtotal (Gross): ₹${quote.subtotal}`);
  console.log(`  Discount Total:   ₹${quote.discountTotal}`);
  console.log(`  Taxable Total:    ₹${quote.taxableTotal}`);
  console.log(`  GST Total:        ₹${quote.gstTotal}`);
  console.log(`  Calculated Total: ₹${quote.calculatedTotal}`);
  console.log(`  Round Off:        ₹${quote.roundOff}`);
  console.log(`  Grand Total:      ₹${quote.grandTotal}`);

  // Expected math check:
  // Item 1: Gross = 4000, Disc = 400, Taxable = 3600, GST = 648, Total = 4248
  // Item 2: Gross = 1250.75, Disc = 62.54, Taxable = 1188.21, GST = 213.88, Total = 1402.09
  // Totals: Gross = 5250.75, Disc = 462.54, Taxable = 4788.21, GST = 861.88, Calc = 5650.09, RoundOff = -0.09, Grand = 5650
  if (Math.abs(quote.grandTotal - Math.round(quote.calculatedTotal)) > 0.01) {
    throw new Error(`TEST 5 FAILED: Grand total ${quote.grandTotal} does not match rounded calculated total ${Math.round(quote.calculatedTotal)}`);
  }
  if (quote.items[0].description !== 'Quotation-specific customized camera with waterproof hood.') {
    throw new Error(`TEST 5 FAILED: Quotation description was not preserved! Got: "${quote.items[0].description}"`);
  }
  console.log(`✓ Quotation description correctly saved: "${quote.items[0].description}"`);

  // Test 6: Verify Product Master is UNCHANGED after quotation description edit
  console.log('\n[TEST 6] Verifying Product Master catalog is untouched by quotation description...');
  const postStockRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/stocks',
    method: 'GET',
    headers
  });
  const postProducts = postStockRes.data?.data?.products || postStockRes.data?.data || [];
  const postProd1 = postProducts.find((p) => (p.id || p.productId) === 'PROD-000001' || p.code === 'PROD-000001');
  if (postProd1.description === 'Quotation-specific customized camera with waterproof hood.') {
    throw new Error('TEST 6 FAILED: Product Master description was mutated by quotation edit!');
  }
  console.log(`✓ Product Master catalog description preserved intact: "${postProd1.description}"`);

  console.log('\n======================================================');
  console.log('ALL BACKEND QUOTATION ENGINE TESTS PASSED SUCCESSFULLY');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
