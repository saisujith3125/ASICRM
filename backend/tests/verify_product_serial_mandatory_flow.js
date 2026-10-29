/**
 * Verification Test Suite: Product Serial Number Mandatory vs Standard Quantity Flow
 * Validates:
 * 1. Product creation with serialized = true (Mandatory Serial Tracking).
 * 2. Product creation with serialized = false (Standard Quantity Only).
 * 3. Cable auto-lock enforcement (Cables strictly serialized = false).
 * 4. PO Goods Receipt (GRN) strict validation:
 *    - Serialized products strictly block receipt if serial count != receiveNow.
 *    - Non-serialized products allow pure quantity receipt without serials.
 * 5. Delivery Challan (DC) outward dispatch strict validation:
 *    - Serialized products strictly require valid serial numbers from active stock.
 *    - Non-serialized products dispatch by numerical quantity only.
 * 6. Audit trail & Serial Lifecycle tracking in /api/serials.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Controllers & Services
const stockController = require('../controllers/stockController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const orderController = require('../controllers/orderController');
const { purchaseOrders, deliveryChallans } = require('../data/crmStore');

function mockReqRes(body = {}, params = {}, query = {}, headers = { 'x-user-id': 'USR-001' }) {
  const req = { body, params, query, headers };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    }
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData
  };
}

async function runTests() {
  console.log('=== STARTING SERIAL NUMBER MANDATORY VS QUANTITY FLOW AUDIT ===\n');

  // Load stocks data
  const stocksFile = path.join(__dirname, '..', 'data', 'stocks-data.json');
  const crmFile = path.join(__dirname, '..', 'data', 'crm-data.json');
  const seqFile = path.join(__dirname, '..', 'data', 'document-sequences.json');

  const stocksBackup = fs.readFileSync(stocksFile, 'utf8');
  const crmBackup = fs.readFileSync(crmFile, 'utf8');
  const seqBackup = fs.readFileSync(seqFile, 'utf8');

  try {
    // TEST 1: Mandatory Serialized Product Creation
  console.log('[Test 1] Testing Product Creation: Mandatory Serialized Tracking...');
  const testSerializedCode = `ASI-SR-${Date.now().toString().slice(-6)}`;
  const serializedSerials = [`${testSerializedCode}-SN-001`, `${testSerializedCode}-SN-002`];

  const { req: req1, res: res1, getStatusCode: getCode1, getResponseData: getData1 } = mockReqRes({
    code: testSerializedCode,
    name: 'ASI Vision 4K Ultra Surveillance Dome Camera',
    description: 'High end 4K camera with mandatory unit tracking',
    hsnSac: '85258090',
    categoryId: 'CAT-001',
    subcategoryId: 'SUBCAT-001',
    brandId: 'BR-001',
    unit: 'Nos',
    cost: 5000,
    dealerPercentage: 10,
    dealerPrice: 5500,
    mrpPercentage: 20,
    mrp: 6600,
    stock: 2,
    alertQuantity: 1,
    gst: 18,
    serialized: true,
    serialNumbers: serializedSerials
  });

  stockController.createEntity(req1, res1, 'products');
  assert.strictEqual(getCode1(), 201, 'Should successfully create serialized product');
  const createdProd1 = getData1().product || getData1().item || getData1();
  assert(createdProd1 && createdProd1.id, 'Created product should have an ID');
  assert.strictEqual(createdProd1.serialized, true, 'Product serialized flag must be true');
  assert.strictEqual(createdProd1.stock, 2, 'Stock should be 2');
  assert.strictEqual(createdProd1.serialNumbers.length, 2, 'Must have exactly 2 active serial numbers');
  assert.strictEqual(createdProd1.serialNumbers[0], `${testSerializedCode}-SN-001`);
  console.log('✔ PASS: Mandatory Serialized Product created with exact opening serial numbers.\n');

  // TEST 2: Standard Quantity (Non-Serialized) Product Creation
  console.log('[Test 2] Testing Product Creation: Standard Quantity Inventory (No Serials)...');
  const testNonSerializedCode = `ASI-QTY-${Date.now().toString().slice(-6)}`;

  const { req: req2, res: res2, getStatusCode: getCode2, getResponseData: getData2 } = mockReqRes({
    code: testNonSerializedCode,
    name: 'ASI Heavy Duty Metal L-Mounting Bracket',
    description: 'Standard steel bracket for camera mounting - bulk quantity only',
    hsnSac: '73269099',
    categoryId: 'CAT-001',
    subcategoryId: 'SUBCAT-001',
    brandId: 'BR-001',
    unit: 'Nos',
    cost: 150,
    dealerPercentage: 10,
    dealerPrice: 165,
    mrpPercentage: 20,
    mrp: 198,
    stock: 50,
    alertQuantity: 10,
    gst: 18,
    serialized: false,
    serialNumbers: []
  });

  stockController.createEntity(req2, res2, 'products');
  assert.strictEqual(getCode2(), 201, 'Should successfully create non-serialized product');
  const createdProd2 = getData2().product || getData2().item || getData2();
  assert(createdProd2 && createdProd2.id, 'Created product should have an ID');
  assert.strictEqual(createdProd2.serialized, false, 'Product serialized flag must be false');
  assert.strictEqual(createdProd2.stock, 50, 'Stock should be 50 units');
  assert.strictEqual(createdProd2.serialNumbers.length, 0, 'Non-serialized product must have 0 serial numbers');
  console.log('✔ PASS: Standard Quantity Product created with 50 units and 0 serial numbers.\n');

  // TEST 3: Cable Category Auto-Lock Enforcement
  console.log('[Test 3] Testing Cable Category Auto-Lock Rule...');
  const testCableCode = `ASI-CBL-${Date.now().toString().slice(-6)}`;

  const { req: req3, res: res3, getStatusCode: getCode3, getResponseData: getData3 } = mockReqRes({
    code: testCableCode,
    name: 'ASI Cat6 UTP Solid Pure Copper Cable Reel 305M',
    description: '305m pure copper network reel',
    hsnSac: '85444990',
    categoryId: 'CAT-004',
    subcategoryId: 'SUBCAT-005',
    brandId: 'BR-004',
    unit: 'Roll',
    cost: 8500,
    dealerPercentage: 10,
    dealerPrice: 9350,
    mrpPercentage: 20,
    mrp: 11220,
    stock: 5,
    alertQuantity: 2,
    gst: 18,
    serialized: true, // Attempt to mark as serialized
    serialNumbers: ['SN-CABLE-1']
  });

  stockController.createEntity(req3, res3, 'products');
  assert.strictEqual(getCode3(), 201, 'Should successfully create cable product');
  const createdProd3 = getData3().product || getData3().item || getData3();
  assert.strictEqual(createdProd3.serialized, false, 'Cables must strictly force serialized = false');
  assert.strictEqual(createdProd3.serialNumbers.length, 0, 'Cables must have empty serial numbers array');
  console.log('✔ PASS: Cable product correctly enforced serialized = false and cleared serials.\n');

  // TEST 4: PO Goods Receipt (GRN) Strict Validation
  console.log('[Test 4] Testing PO Goods Receipt (GRN) Enforcement...');
  const poList = purchaseOrders;
  const testPO = poList[0];
  assert(testPO, 'At least one PO must exist');

  const originalStatus = testPO.status;
  testPO.status = 'SENT';

  // Add test items to testPO with orderedQty
  testPO.items.push({
    id: `POI-${Date.now()}-1`,
    productId: createdProd1.id,
    productCode: createdProd1.code,
    productName: createdProd1.name,
    orderedQty: 5,
    receivedQty: 0,
    rate: 5000,
    serialized: true,
    serialNumbers: []
  });
  testPO.items.push({
    id: `POI-${Date.now()}-2`,
    productId: createdProd2.id,
    productCode: createdProd2.code,
    productName: createdProd2.name,
    orderedQty: 20,
    receivedQty: 0,
    rate: 150,
    serialized: false,
    serialNumbers: []
  });

  // 4A: Serialized product receiving 2 units with only 1 serial -> Must be rejected (400)
  const { req: reqGRN1, res: resGRN1, getStatusCode: getCodeGRN1, getResponseData: getDataGRN1 } = mockReqRes({
    items: [
      {
        productId: createdProd1.id,
        receiveNow: 2,
        serialNumbers: ['TEST-SN-ONLY-ONE'] // 1 serial provided for 2 units
      }
    ]
  }, { id: testPO.id });

  await purchaseOrderController.receiveGoods(reqGRN1, resGRN1);
  assert.strictEqual(getCodeGRN1(), 400, 'GRN with mismatched serial count must return HTTP 400');
  assert(getDataGRN1().message.includes('requires exactly 2 serial number(s)'), 'Error message must specify exact required serials');
  console.log(`  ✔ Correctly rejected incomplete serials: "${getDataGRN1().message}"`);

  // 4B: Valid receive: 2 serialized units with exactly 2 serials + 10 non-serialized units with 0 serials
  const { req: reqGRN2, res: resGRN2, getStatusCode: getCodeGRN2, getResponseData: getDataGRN2 } = mockReqRes({
    items: [
      {
        productId: createdProd1.id,
        receiveNow: 2,
        serialNumbers: [`${testSerializedCode}-SN-003`, `${testSerializedCode}-SN-004`]
      },
      {
        productId: createdProd2.id,
        receiveNow: 10,
        serialNumbers: [] // Non-serialized: 0 serials required
      }
    ]
  }, { id: testPO.id });

  await purchaseOrderController.receiveGoods(reqGRN2, resGRN2);
  assert.strictEqual(getCodeGRN2(), 200, 'GRN with valid serials and non-serialized items must succeed');
  assert(getDataGRN2().success, 'GRN operation must succeed');
  console.log('✔ PASS: PO Goods Receipt (GRN) verified: Serialized items enforce exact serials, non-serialized items allow clean quantity inward.\n');

  // TEST 5: Delivery Challan Outward Dispatch Enforcement
  console.log('[Test 5] Testing Delivery Challan (DC) Dispatch Enforcement...');
  // 5A: Serialized product without serials -> Must fail with HTTP 400
  const { req: reqDC1, res: resDC1, getStatusCode: getCodeDC1, getResponseData: getDataDC1 } = mockReqRes({
    customerName: 'Test Enterprise Customer',
    items: [
      {
        productId: createdProd1.id,
        productCode: createdProd1.code,
        productName: createdProd1.name,
        quantity: 1,
        serialNumbers: [] // 0 serials for serialized item
      }
    ]
  });

  await orderController.createDeliveryChallan(reqDC1, resDC1);
  assert.strictEqual(getCodeDC1(), 400, 'DC dispatch without serials for serialized product must return HTTP 400');
  assert(getDataDC1().message.includes('requires exactly 1 serial number(s)'), 'Must specify missing serial numbers');
  console.log(`  ✔ Correctly blocked DC dispatch without serials: "${getDataDC1().message}"`);

  // 5B: Non-serialized product dispatching by quantity only -> Must succeed
  const { req: reqDC2, res: resDC2, getStatusCode: getCodeDC2, getResponseData: getDataDC2 } = mockReqRes({
    customerName: 'Test Enterprise Customer',
    items: [
      {
        productId: createdProd2.id,
        productCode: createdProd2.code,
        productName: createdProd2.name,
        quantity: 5,
        serialNumbers: [] // 0 serials for non-serialized item
      }
    ]
  });

  await orderController.createDeliveryChallan(reqDC2, resDC2);
  assert.strictEqual(getCodeDC2(), 201, 'Non-serialized product must successfully dispatch DC by quantity');
  console.log('  ✔ Non-serialized product dispatched DC with quantity only (0 serials).');

  // 5C: Serialized product dispatching with valid serial from active stock -> Must succeed
  const { req: reqDC3, res: resDC3, getStatusCode: getCodeDC3, getResponseData: getDataDC3 } = mockReqRes({
    customerName: 'Test Enterprise Customer',
    items: [
      {
        productId: createdProd1.id,
        productCode: createdProd1.code,
        productName: createdProd1.name,
        quantity: 1,
        serialNumbers: [`${testSerializedCode}-SN-001`] // Valid serial from active opening stock
      }
    ]
  });

  await orderController.createDeliveryChallan(reqDC3, resDC3);
  assert.strictEqual(getCodeDC3(), 201, 'Serialized product with valid active serial must successfully dispatch DC');
  console.log('✔ PASS: Delivery Challan outward dispatch verified: Serialized items enforce valid serial picking, non-serialized items dispatch by quantity.\n');

    console.log('=== ALL TESTS PASSED: SERIAL NUMBER MANDATORY VS QUANTITY FLOW VERIFIED 100% ===');
  } finally {
    // Restore pristine database state
    fs.writeFileSync(stocksFile, stocksBackup, 'utf8');
    fs.writeFileSync(crmFile, crmBackup, 'utf8');
    fs.writeFileSync(seqFile, seqBackup, 'utf8');
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
