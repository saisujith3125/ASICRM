const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper for HTTP requests
function request({ hostname = 'localhost', port = 5000, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request({ hostname, port, path, method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function calculateEngineTotals(items, { showDiscount = false, roundOffTotal = false } = {}) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;

  for (const item of items) {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    const unitPrice = Math.max(0, parseFloat(item.unitPrice) || 0);
    const gst = Math.max(0, Math.min(100, parseFloat(item.gst !== undefined ? item.gst : 18) || 0));
    const discountPct = showDiscount
      ? Math.max(0, Math.min(100, parseFloat(item.discount !== undefined ? item.discount : 0) || 0))
      : 0;

    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    const discountAmount = showDiscount ? Math.round((lineSubtotal * (discountPct / 100)) * 100) / 100 : 0;
    const taxableAmount = Math.max(0, Math.round((lineSubtotal - discountAmount) * 100) / 100);
    const lineTax = Math.round(((taxableAmount * gst) / 100) * 100) / 100;

    subtotal += lineSubtotal;
    discountTotal += discountAmount;
    taxableTotal += taxableAmount;
    gstTotal += lineTax;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  discountTotal = Math.round(discountTotal * 100) / 100;
  taxableTotal = Math.round(taxableTotal * 100) / 100;
  gstTotal = Math.round(gstTotal * 100) / 100;

  const calculatedTotal = Math.round((taxableTotal + gstTotal) * 100) / 100;
  let roundOff = 0;
  let grandTotal = calculatedTotal;

  if (roundOffTotal && calculatedTotal > 0) {
    grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
  } else {
    grandTotal = calculatedTotal;
    roundOff = 0;
  }

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    gstTotal,
    calculatedTotal,
    roundOff,
    grandTotal
  };
}

async function runTests() {
  console.log('============================================================');
  console.log('TESTING QUOTATION ROUND OFF BUSINESS RULE: NEXT WHOLE NUMBER');
  console.log('============================================================\n');

  // --- PART 1: PURE ENGINE TESTS ON ALL USER-SPECIFIED TEST CASES ---
  console.log('[PART 1] Verifying core formula: Math.floor(calculatedTotal) + 1 on test cases...');

  const edgeCases = [
    { calc: 676.01, expectedGrand: 677.00, expectedRoundOff: 0.99 },
    { calc: 676.99, expectedGrand: 677.00, expectedRoundOff: 0.01 },
    { calc: 676.00, expectedGrand: 677.00, expectedRoundOff: 1.00 },
    { calc: 677.01, expectedGrand: 678.00, expectedRoundOff: 0.99 },
    { calc: 677.00, expectedGrand: 678.00, expectedRoundOff: 1.00 },
    { calc: 4980.09, expectedGrand: 4981.00, expectedRoundOff: 0.91 },
    { calc: 4980.00, expectedGrand: 4981.00, expectedRoundOff: 1.00 },
    { calc: 5724.06, expectedGrand: 5725.00, expectedRoundOff: 0.94 },
    { calc: 100.01, expectedGrand: 101.00, expectedRoundOff: 0.99 },
    { calc: 100.99, expectedGrand: 101.00, expectedRoundOff: 0.01 },
    { calc: 100.00, expectedGrand: 101.00, expectedRoundOff: 1.00 },
    { calc: 100.50, expectedGrand: 101.00, expectedRoundOff: 0.50 },
    { calc: 999.99, expectedGrand: 1000.00, expectedRoundOff: 0.01 },
    { calc: 1000.00, expectedGrand: 1001.00, expectedRoundOff: 1.00 }
  ];

  for (const tc of edgeCases) {
    const res = calculateEngineTotals([{ quantity: 1, unitPrice: tc.calc, gst: 0 }], { roundOffTotal: true });
    if (res.grandTotal !== tc.expectedGrand || res.roundOff !== tc.expectedRoundOff) {
      throw new Error(`Edge case failed for ${tc.calc}: expected grand=${tc.expectedGrand}, roundOff=${tc.expectedRoundOff}; got grand=${res.grandTotal}, roundOff=${res.roundOff}`);
    }
    console.log(`  ✓ Calc: ₹${tc.calc.toFixed(2)} -> Grand: ₹${res.grandTotal.toFixed(2)}, RoundOff: +₹${res.roundOff.toFixed(2)}`);
  }

  // TEST 9: Round Off OFF
  console.log('\n[TEST 9] Round Off OFF:');
  const resOff = calculateEngineTotals([{ quantity: 1, unitPrice: 5724.06, gst: 0 }], { roundOffTotal: false });
  if (resOff.grandTotal !== 5724.06 || resOff.roundOff !== 0) {
    throw new Error(`Round Off OFF failed: expected grand=5724.06, roundOff=0; got grand=${resOff.grandTotal}, roundOff=${resOff.roundOff}`);
  }
  console.log(`  ✓ Calc: ₹5724.06 -> Grand: ₹${resOff.grandTotal.toFixed(2)}, RoundOff: ₹${resOff.roundOff.toFixed(2)}`);

  // TEST 10: Toggle ON then OFF
  console.log('\n[TEST 10] Toggle ON then OFF:');
  const resOn = calculateEngineTotals([{ quantity: 1, unitPrice: 5724.06, gst: 0 }], { roundOffTotal: true });
  const resOffAgain = calculateEngineTotals([{ quantity: 1, unitPrice: 5724.06, gst: 0 }], { roundOffTotal: false });
  if (resOn.grandTotal !== 5725.00 || resOffAgain.grandTotal !== 5724.06) {
    throw new Error('Toggle ON then OFF failed');
  }
  console.log(`  ✓ ON -> ₹${resOn.grandTotal.toFixed(2)}, OFF -> ₹${resOffAgain.grandTotal.toFixed(2)}`);

  // TEST 17: Discount + Round-Off combined
  console.log('\n[TEST 17] Discount + Round-Off combined:');
  const resDisc = calculateEngineTotals(
    [{ quantity: 1, unitPrice: 5000, discount: 10, gst: 18 }],
    { showDiscount: true, roundOffTotal: true }
  );
  if (resDisc.subtotal !== 5000 || resDisc.discountTotal !== 500 || resDisc.taxableTotal !== 4500 || resDisc.gstTotal !== 810 || resDisc.calculatedTotal !== 5310 || resDisc.grandTotal !== 5311 || resDisc.roundOff !== 1.00) {
    throw new Error(`Discount + Round-Off failed: ${JSON.stringify(resDisc)}`);
  }
  console.log(`  ✓ Gross: ₹${resDisc.subtotal}, Disc: ₹${resDisc.discountTotal}, Taxable: ₹${resDisc.taxableTotal}, GST: ₹${resDisc.gstTotal}, Calc: ₹${resDisc.calculatedTotal}, RoundOff: +₹${resDisc.roundOff.toFixed(2)}, Grand: ₹${resDisc.grandTotal.toFixed(2)}`);

  // --- PART 2: BACKEND API PERSISTENCE, REOPEN, AND NO DOUBLE-ROUND TEST ---
  console.log('\n[PART 2] Testing backend quotation creation, round-off persistence, and reopening...');

  // Super Admin Auth headers
  const authHeaders = {
    'x-user-id': 'USR-001',
    'x-user-role': 'Super Admin',
    'x-user-email': 'admin@active.com'
  };

  // Get existing customer and stock product
  const custRes = await request({ path: '/api/customers', headers: authHeaders });
  const cust = custRes.data?.data?.[0] || custRes.data?.[0];
  if (!cust) throw new Error('No customer found in master.');

  const stockRes = await request({ path: '/api/stocks', headers: authHeaders });
  const products = stockRes.data?.data?.products || stockRes.data?.data || [];
  const prod1 = products[0];
  if (!prod1) throw new Error('No stock product found.');

  // Create a real quotation with Round Off ON matching user screenshot example
  console.log(`\nCreating quotation for customer ${cust.name} with product ${prod1.name}...`);
  // Subtotal = 4850.90, GST 18% = 873.16 -> Calculated Total = 5724.06 -> Round Off = +0.94 -> Grand Total = 5725.00
  const createPayload = {
    customerId: cust.id,
    items: [
      {
        productId: prod1.id,
        quantity: 1,
        unitPrice: 4850.90,
        gst: 18,
        description: 'Testing quotation next whole number round off rule'
      }
    ],
    showDiscount: false,
    roundOffTotal: true,
    validUntil: '2026-10-31',
    remarks: 'Round Off Rule Verification Quotation'
  };

  const createRes = await request({
    path: '/api/enquiries/quotations',
    method: 'POST',
    headers: authHeaders,
    body: createPayload
  });

  if (createRes.status !== 200 && createRes.status !== 201) {
    throw new Error(`Failed to create quotation: status=${createRes.status}, data=${JSON.stringify(createRes.data)}`);
  }

  const savedQuote = createRes.data?.data || createRes.data?.quotation;
  const quoteId = savedQuote.quotationId;
  console.log(`✓ Quotation created successfully: ${quoteId}`);
  console.log(`  Calculated Total: ₹${savedQuote.calculatedTotal}`);
  console.log(`  Round Off:        ₹${savedQuote.roundOff}`);
  console.log(`  Grand Total:      ₹${savedQuote.grandTotal}`);

  // Verification 1: roundOff must be strictly > 0 and grandTotal === Math.floor(calculatedTotal) + 1
  const expectedNextWhole = Math.floor(savedQuote.calculatedTotal + 1e-9) + 1;
  const expectedRo = Math.round((expectedNextWhole - savedQuote.calculatedTotal) * 100) / 100;
  if (savedQuote.grandTotal !== expectedNextWhole) {
    throw new Error(`Saved quotation grandTotal ${savedQuote.grandTotal} !== expected ${expectedNextWhole}`);
  }
  if (savedQuote.roundOff !== expectedRo || savedQuote.roundOff <= 0) {
    throw new Error(`Saved quotation roundOff ${savedQuote.roundOff} !== expected positive ${expectedRo}`);
  }
  console.log(`✓ Backend calculated: Next whole number ₹${expectedNextWhole} with positive round-off +₹${expectedRo}`);

  // Verification 2: Reopen and update quotation without changing items (TEST 12: PREVENT DOUBLE APPLICATION)
  console.log('\n[TEST 12] Reopening and updating quotation without changing items (verifying NO double round-off)...');
  const updatePayload = {
    customerId: cust.id,
    items: savedQuote.items,
    showDiscount: savedQuote.showDiscount,
    roundOffTotal: true,
    validUntil: savedQuote.validUntil,
    remarks: savedQuote.remarks
  };

  const updateRes = await request({
    path: `/api/enquiries/quotation/${encodeURIComponent(quoteId)}`,
    method: 'PUT',
    headers: authHeaders,
    body: updatePayload
  });

  if (updateRes.status !== 200) {
    throw new Error(`Failed to update quotation: status=${updateRes.status}, data=${JSON.stringify(updateRes.data)}`);
  }

  const updatedQuote = updateRes.data?.quotation || updateRes.data?.data;
  console.log(`  Calculated Total: ₹${updatedQuote.calculatedTotal}`);
  console.log(`  Round Off:        ₹${updatedQuote.roundOff}`);
  console.log(`  Grand Total:      ₹${updatedQuote.grandTotal}`);

  if (updatedQuote.grandTotal !== expectedNextWhole) {
    throw new Error(`DOUBLE ROUND-OFF DETECTED! Expected grandTotal ₹${expectedNextWhole}, but got ₹${updatedQuote.grandTotal}`);
  }
  console.log(`✓ Reopened quotation preserved exact grand total: ₹${updatedQuote.grandTotal} (NO double rounding)`);

  // Verification 3: Toggle Round Off OFF
  console.log('\n[TEST 10b] Toggling Round Off OFF on saved quotation...');
  const updateOffRes = await request({
    path: `/api/enquiries/quotation/${encodeURIComponent(quoteId)}`,
    method: 'PUT',
    headers: authHeaders,
    body: {
      ...updatePayload,
      roundOffTotal: false
    }
  });

  const updatedOffQuote = updateOffRes.data?.quotation || updateOffRes.data?.data;
  console.log(`  Calculated Total: ₹${updatedOffQuote.calculatedTotal}`);
  console.log(`  Round Off:        ₹${updatedOffQuote.roundOff}`);
  console.log(`  Grand Total:      ₹${updatedOffQuote.grandTotal}`);

  if (updatedOffQuote.grandTotal !== updatedOffQuote.calculatedTotal || updatedOffQuote.roundOff !== 0) {
    throw new Error(`Round Off OFF failed: grandTotal ${updatedOffQuote.grandTotal} !== calculatedTotal ${updatedOffQuote.calculatedTotal}`);
  }
  console.log(`✓ Round Off OFF correctly set roundOff = 0 and grandTotal = calculatedTotal`);

  // Verification 4: Toggle Round Off ON again
  console.log('\n[TEST 11] Toggling Round Off ON again...');
  const updateOnAgainRes = await request({
    path: `/api/enquiries/quotation/${encodeURIComponent(quoteId)}`,
    method: 'PUT',
    headers: authHeaders,
    body: {
      ...updatePayload,
      roundOffTotal: true
    }
  });

  const updatedOnAgainQuote = updateOnAgainRes.data?.quotation || updateOnAgainRes.data?.data;
  if (updatedOnAgainQuote.grandTotal !== expectedNextWhole || updatedOnAgainQuote.roundOff !== expectedRo) {
    throw new Error(`Round Off ON again failed: expected ${expectedNextWhole}, got ${updatedOnAgainQuote.grandTotal}`);
  }
  console.log(`✓ Round Off ON again recalculated correctly: grandTotal = ₹${updatedOnAgainQuote.grandTotal}, roundOff = +₹${updatedOnAgainQuote.roundOff}`);

  console.log('\n============================================================');
  console.log('ALL QUOTATION ROUND-OFF BUSINESS RULE TESTS PASSED (100%)');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
