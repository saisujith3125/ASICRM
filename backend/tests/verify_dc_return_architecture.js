/**
 * verify_dc_return_architecture.js
 * Comprehensive automated verification script testing:
 * 1. Distinction between Original Purpose (Normal vs Returnable) and Return State (Not Returned, Partially Returned, Fully Returned).
 * 2. Original DC immutability (delivered qty, purpose, documentType never mutated).
 * 3. Partial return creates immutable PARTIAL RETURN DC (RDC-XXXXXX-001).
 * 4. Over-return blocked with exact message: "Only ${remaining} units remain available for return."
 * 5. Subsequent return creates RETURN DC (RDC-XXXXXX-002), without renaming previous return document #1.
 * 6. Fully returned DC blocked with exact message: "Full quantity already returned."
 * 7. Stock movement validation: event === 'Return DC', referenceType === 'RET', positive qty, serial restoration.
 */

const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:5000/api/orders';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-user-id': 'USR-001'
};

async function runTests() {
  console.log('====================================================');
  console.log('STARTING DELIVERY CHALLAN RETURN ARCHITECTURE TESTS');
  console.log('====================================================\n');

  // Step 0: Get available product and serial numbers
  console.log('0. Fetching eligible stock and serial numbers...');
  const serialsRes = await fetch(`${BASE_URL}/available-serials`, { headers: HEADERS });
  const serialsData = await serialsRes.json();
  assert(serialsData.success, 'Failed to fetch available serial numbers');
  const prod = serialsData.data.find((p) => p.availableSerials && p.availableSerials.length >= 6);
  assert(prod, 'Need a product with at least 6 available serials for testing');
  const chosenSerials = prod.availableSerials.slice(0, 6);
  console.log(`✓ Using Product: "${prod.productName}" (${prod.productCode}) with 6 serials:`, chosenSerials);

  // Step 1: Create a fresh test delivery challan with 6 units of the product
  console.log('\n1. Creating a new test Delivery Challan (Sent: 6 units, Purpose: Returnable / Temporary)...');
  const dcPayload = {
    customerId: 'CUST-001',
    customerName: 'Aarav Sharma',
    company: 'Sharma Enterprises',
    deliveryPurpose: 'RETURNABLE',
    documentType: 'RETURNABLE_DC',
    deliveryDate: '2026-09-30',
    transitMode: 'Direct Courier',
    executiveEngineer: 'Rajesh Nair',
    materialReturnedBy: 'Karan Patel',
    items: [
      {
        productId: prod.productId,
        productCode: prod.productCode,
        productName: prod.productName,
        productDetails: 'Test Enterprise Consignment',
        quantity: 6,
        unit: 'Nos',
        serialNumbers: chosenSerials
      }
    ]
  };

  const createRes = await fetch(`${BASE_URL}/delivery-challans`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(dcPayload)
  });
  const createData = await createRes.json();
  assert(createData.success, `Failed to create test DC: ${createData.message}`);
  const testDc = createData.data;
  const dcId = testDc.challanId;
  console.log(`✓ Created DC: ${dcId}`);
  assert.strictEqual(testDc.deliveryPurpose, 'RETURNABLE', 'Original purpose must be RETURNABLE');
  assert.strictEqual(testDc.documentType, 'RETURNABLE_DC', 'Original documentType must be RETURNABLE_DC');
  assert.strictEqual(testDc.items[0].quantity, 6, 'Delivered quantity must be 6');

  // Step 2: Test Partial Return of 2 units (Remaining = 4)
  console.log('\n2. Testing Partial Return: Returning 2 of 6 units with serials...');
  const ret1Serials = chosenSerials.slice(0, 2);
  const ret1Payload = {
    deliveryDate: '2026-09-30',
    returnReason: 'Demo Equipment Return',
    remarks: 'Customer completed evaluation of 2 units',
    executiveEngineer: 'Rajesh Nair',
    materialReturnedBy: 'Karan Patel',
    returnedItems: [
      {
        productId: prod.productId,
        productCode: prod.productCode,
        returnNowQty: 2,
        returnedSerials: ret1Serials
      }
    ]
  };

  const ret1Res = await fetch(`${BASE_URL}/delivery-challans/${dcId}/status`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(ret1Payload)
  });
  const ret1Data = await ret1Res.json();
  assert(ret1Data.success, `Failed partial return: ${ret1Data.message}`);
  const dcAfterRet1 = ret1Data.data;

  console.log(`✓ Partial return recorded successfully.`);
  assert.strictEqual(dcAfterRet1.status, 'PARTIALLY RETURNED', 'Status must be PARTIALLY RETURNED');
  assert.strictEqual(dcAfterRet1.returnStatus, 'PARTIALLY_RETURNED', 'ReturnStatus must be PARTIALLY_RETURNED');
  assert.strictEqual(dcAfterRet1.returnedUnits, 2, 'Cumulative returned units must be 2');
  assert.strictEqual(dcAfterRet1.remainingUnits, 4, 'Remaining units must be 4');
  assert.strictEqual(dcAfterRet1.deliveryPurpose, 'RETURNABLE', 'Original purpose MUST NOT change');
  assert.strictEqual(dcAfterRet1.documentType, 'RETURNABLE_DC', 'Original documentType MUST NOT change');
  assert.strictEqual(dcAfterRet1.items[0].quantity, 6, 'Original item quantity MUST remain 6');
  assert.strictEqual(dcAfterRet1.items[0].returnedQty, 2, 'Item returnedQty must be 2');
  assert.strictEqual(dcAfterRet1.items[0].remainingQty, 4, 'Item remainingQty must be 4');

  // Verify return document #1 in returnedHistory
  assert(Array.isArray(dcAfterRet1.returnedHistory) && dcAfterRet1.returnedHistory.length === 1, 'Must have 1 history record');
  const doc1 = dcAfterRet1.returnedHistory[0];
  console.log(`✓ Return Document #1: ${doc1.returnId} | Title: ${doc1.documentTitle} | Status: [${doc1.returnStatus}]`);
  assert(doc1.returnId.startsWith('RDC-'), `Return ID must start with RDC-: ${doc1.returnId}`);
  assert.strictEqual(doc1.documentTitle, 'PARTIAL RETURN DC', 'First return document title must be PARTIAL RETURN DC');
  assert.strictEqual(doc1.returnStatus, 'PARTIALLY_RETURNED', 'First return status must be PARTIALLY_RETURNED');
  assert.strictEqual(doc1.returnedUnits, 2, 'Document #1 returnedUnits must be 2');
  assert.strictEqual(doc1.remainingUnits, 4, 'Document #1 remainingUnits must be 4');

  // Step 3: Test Over-return Rejection (Attempting to return 5 units when only 4 remain)
  console.log('\n3. Testing Over-return Validation: Attempting to return 5 units (4 remain)...');
  const overRetPayload = {
    deliveryDate: '2026-09-30',
    returnReason: 'Demo Equipment Return',
    returnedItems: [
      {
        productId: prod.productId,
        productCode: prod.productCode,
        returnNowQty: 5,
        returnedSerials: chosenSerials.slice(2, 7) // 5 serials
      }
    ]
  };

  const overRetRes = await fetch(`${BASE_URL}/delivery-challans/${dcId}/status`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(overRetPayload)
  });
  const overRetData = await overRetRes.json();
  console.log(`Response status: ${overRetRes.status} | Message: "${overRetData.message}"`);
  assert.strictEqual(overRetRes.status, 400, 'Over-return must be rejected with 400');
  assert(
    overRetData.message.includes('Only 4 units remain available for return'),
    `Error message must say "Only 4 units remain available for return." Actual: "${overRetData.message}"`
  );
  console.log('✓ Over-return correctly rejected with exact required message.');

  // Step 4: Test Second Return completing the remaining 4 units
  console.log('\n4. Testing Second Return: Returning remaining 4 units with serials...');
  const ret2Serials = chosenSerials.slice(2, 6); // remaining 4 serials
  const ret2Payload = {
    deliveryDate: '2026-09-30',
    returnReason: 'Demo Equipment Return',
    remarks: 'Final 4 units returned in good condition',
    executiveEngineer: 'Rajesh Nair',
    materialReturnedBy: 'Karan Patel',
    returnedItems: [
      {
        productId: prod.productId,
        productCode: prod.productCode,
        returnNowQty: 4,
        returnedSerials: ret2Serials
      }
    ]
  };

  const ret2Res = await fetch(`${BASE_URL}/delivery-challans/${dcId}/status`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(ret2Payload)
  });
  const ret2Data = await ret2Res.json();
  assert(ret2Data.success, `Failed second return: ${ret2Data.message}`);
  const dcAfterRet2 = ret2Data.data;

  console.log(`✓ Second return recorded successfully.`);
  assert.strictEqual(dcAfterRet2.status, 'RETURNED', 'Status must be RETURNED');
  assert.strictEqual(dcAfterRet2.returnStatus, 'FULLY_RETURNED', 'ReturnStatus must be FULLY_RETURNED');
  assert.strictEqual(dcAfterRet2.returnedUnits, 6, 'Cumulative returned units must be 6');
  assert.strictEqual(dcAfterRet2.remainingUnits, 0, 'Remaining units must be 0');
  assert.strictEqual(dcAfterRet2.deliveryPurpose, 'RETURNABLE', 'Original purpose MUST NOT change');
  assert.strictEqual(dcAfterRet2.documentType, 'RETURNABLE_DC', 'Original documentType MUST NOT change');
  assert.strictEqual(dcAfterRet2.items[0].quantity, 6, 'Original item quantity MUST remain 6');
  assert.strictEqual(dcAfterRet2.items[0].returnedQty, 6, 'Item cumulative returnedQty must be 6');
  assert.strictEqual(dcAfterRet2.items[0].remainingQty, 0, 'Item remainingQty must be 0');

  // Verify BOTH return documents in history and check IMMUTABILITY
  assert(Array.isArray(dcAfterRet2.returnedHistory) && dcAfterRet2.returnedHistory.length === 2, 'Must have 2 history records');
  const histDoc1 = dcAfterRet2.returnedHistory[0];
  const histDoc2 = dcAfterRet2.returnedHistory[1];

  console.log(`✓ Hist Doc #1: ${histDoc1.returnId} | Title: ${histDoc1.documentTitle} | Status: [${histDoc1.returnStatus}]`);
  console.log(`✓ Hist Doc #2: ${histDoc2.returnId} | Title: ${histDoc2.documentTitle} | Status: [${histDoc2.returnStatus}]`);

  // CRITICAL REQUIREMENT: Return document #1 was NOT renamed or modified!
  assert.strictEqual(histDoc1.documentTitle, 'PARTIAL RETURN DC', 'Doc #1 MUST remain PARTIAL RETURN DC (not renamed)');
  assert.strictEqual(histDoc1.returnStatus, 'PARTIALLY_RETURNED', 'Doc #1 status MUST remain PARTIALLY_RETURNED');
  assert.strictEqual(histDoc1.returnedUnits, 2, 'Doc #1 returned units MUST remain 2');

  // Return document #2 is FULL RETURN DC
  assert.strictEqual(histDoc2.documentTitle, 'RETURN DC', 'Doc #2 title must be RETURN DC');
  assert.strictEqual(histDoc2.returnStatus, 'FULLY_RETURNED', 'Doc #2 status must be FULLY_RETURNED');
  assert.strictEqual(histDoc2.returnedUnits, 4, 'Doc #2 returned units must be 4');
  assert.strictEqual(histDoc2.remainingUnits, 0, 'Doc #2 remaining units must be 0');

  // Step 5: Test Full Return Rejection (DC already fully returned)
  console.log('\n5. Testing Return Rejection on Fully Returned DC...');
  const postFullRetRes = await fetch(`${BASE_URL}/delivery-challans/${dcId}/status`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      deliveryDate: '2026-09-30',
      returnReason: 'Attempt Extra Return',
      returnedItems: [
        {
          productId: prod.productId,
          productCode: prod.productCode,
          returnNowQty: 1
        }
      ]
    })
  });
  const postFullRetData = await postFullRetRes.json();
  console.log(`Response status: ${postFullRetRes.status} | Message: "${postFullRetData.message}"`);
  assert.strictEqual(postFullRetRes.status, 400, 'Return on fully returned DC must be rejected with 400');
  assert.strictEqual(postFullRetData.message, 'Full quantity already returned.', 'Error message must be "Full quantity already returned."');
  console.log('✓ Return on fully returned DC correctly rejected with exact message.');

  // Step 6: Verify Stock Transactions & Serials Restoration
  console.log('\n6. Verifying Inventory Transactions & Serial Restoration...');
  const fs = require('fs');
  const path = require('path');
  const stocksData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stocks-data.json'), 'utf8'));
  const matchingTxns = (stocksData.inventoryTransactions || []).filter((t) => t.reference === dcId && t.referenceType === 'RET');
  console.log(`Found ${matchingTxns.length} stock return transactions for DC ${dcId}:`);
  matchingTxns.forEach((t) => {
    console.log(` - Event: "${t.event}" | RefType: "${t.referenceType}" | Qty: +${t.quantity} | Serials:`, t.serialNumbers);
    assert.strictEqual(t.event, 'Return DC', 'Event must be Return DC');
    assert.strictEqual(t.referenceType, 'RET', 'RefType must be RET');
    assert(t.quantity > 0, 'Return quantity must be positive');
  });
  assert(matchingTxns.length >= 2, 'Must have at least 2 return transactions in stock log');

  // Verify all 6 serial numbers are restored to product stock
  const updatedProduct = stocksData.products.find((p) => p.id === prod.productId);
  const currentSerialsSet = new Set(updatedProduct.serialNumbers || []);
  for (const sn of chosenSerials) {
    assert(currentSerialsSet.has(sn), `Serial ${sn} must be restored to active product stock`);
  }
  console.log('✓ All 6 returned serial numbers verified back in active stock.');

  console.log('\n====================================================');
  console.log('ALL DELIVERY CHALLAN RETURN ARCHITECTURE TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
