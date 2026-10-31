const assert = require('assert');
const path = require('path');
const fs = require('fs');

const stockController = require('../controllers/stockController');

function mockReqRes(body = {}, params = {}, query = {}, headers = { 'x-user-id': 'USR-001' }) {
  let statusCode = 200;
  let responseData = null;
  const req = { body, params, query, headers };
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
  console.log('=== STARTING ADD PRODUCT SERIALS & OPENING STOCK FLOW VERIFICATION ===\n');

  const stocksFile = path.join(__dirname, '..', 'data', 'stocks-data.json');
  const stocksBackup = fs.readFileSync(stocksFile, 'utf8');

  try {
    // TEST 1: Direct Serial Numbers entry with openingStock = 0 -> syncs openingStock to serials length
    console.log('[Test 1] Direct Serial Numbers Entry (Opening stock was 0)...');
    const code1 = `ASI-TEST-${Date.now().toString().slice(-5)}-A`;
    const serials1 = [`${code1}-SN-001`, `${code1}-SN-002`, `${code1}-SN-003`];
    const { req: req1, res: res1, getStatusCode: codeRes1, getResponseData: data1 } = mockReqRes({
      code: code1,
      name: 'ASI Direct Serial Camera Model X',
      description: 'Camera with direct serial entry',
      hsnSac: '85258090',
      categoryId: 'CAT-001',
      subcategoryId: 'SUBCAT-001',
      brandId: 'BR-001',
      unit: 'Nos',
      cost: 4000,
      dealerPercentage: 10,
      dealerPrice: 4400,
      mrpPercentage: 20,
      mrp: 4840,
      stock: 0, // initially passed as 0 or empty
      alertQuantity: 2,
      gst: 18,
      serialized: true,
      serialNumbers: serials1
    });

    stockController.createEntity(req1, res1, 'products');
    assert.strictEqual(codeRes1(), 201, 'Should return status 201 Created');
    const prod1 = data1().product || data1().item;
    assert.strictEqual(prod1.stock, 3, 'Stock should be automatically synced to 3 based on serials count');
    assert.strictEqual(prod1.serialNumbers.length, 3, 'Must have 3 serial numbers');
    assert.deepStrictEqual(prod1.serialNumbers, serials1, 'Serial numbers must match provided serials');
    console.log('✔ PASS: Direct serial entry correctly synced opening stock to 3 and persisted serials.');

    // TEST 2: Serialized product with openingStock = 2 and exact 2 serial numbers
    console.log('\n[Test 2] Opening stock = 2 and exact 2 serial numbers...');
    const code2 = `ASI-TEST-${Date.now().toString().slice(-5)}-B`;
    const serials2 = [`${code2}-SN-1001`, `${code2}-SN-1002`];
    const { req: req2, res: res2, getStatusCode: codeRes2, getResponseData: data2 } = mockReqRes({
      code: code2,
      name: 'ASI Matched Product Model Y',
      description: 'Matched stock and serials',
      hsnSac: '85258090',
      categoryId: 'CAT-001',
      subcategoryId: 'SUBCAT-001',
      brandId: 'BR-001',
      unit: 'Nos',
      cost: 2500,
      dealerPercentage: 10,
      dealerPrice: 2750,
      mrpPercentage: 20,
      mrp: 3025,
      stock: 2,
      alertQuantity: 1,
      gst: 18,
      serialized: true,
      serialNumbers: serials2
    });

    stockController.createEntity(req2, res2, 'products');
    assert.strictEqual(codeRes2(), 201, 'Should return status 201');
    const prod2 = data2().product || data2().item;
    assert.strictEqual(prod2.stock, 2, 'Stock should be 2');
    assert.strictEqual(prod2.serialNumbers.length, 2, 'Must have exactly 2 serial numbers');
    console.log('✔ PASS: Matched opening stock and serial numbers verified.');

    // TEST 3: Cable Product auto-lock (cables must never have serial numbers)
    console.log('\n[Test 3] Cable product serialization lock...');
    const code3 = `ASI-TEST-${Date.now().toString().slice(-5)}-C`;
    const { req: req3, res: res3, getStatusCode: codeRes3, getResponseData: data3 } = mockReqRes({
      code: code3,
      name: 'Cat 6 UTP Network Patch Cable 305m',
      description: 'Bulk cable roll',
      hsnSac: '85444990',
      categoryId: 'CAT-004',
      subcategoryId: 'SUBCAT-005',
      brandId: 'BR-004',
      unit: 'Roll',
      cost: 6500,
      dealerPercentage: 10,
      dealerPrice: 7150,
      mrpPercentage: 20,
      mrp: 7865,
      stock: 10,
      alertQuantity: 2,
      gst: 18,
      serialized: true, // Attempt to serialize cable
      serialNumbers: ['SN-001', 'SN-002']
    });

    stockController.createEntity(req3, res3, 'products');
    assert.strictEqual(codeRes3(), 201, 'Should create cable product');
    const prod3 = data3().product || data3().item;
    assert.strictEqual(prod3.serialized, false, 'Cable product serialized must be false');
    assert.strictEqual(prod3.serialNumbers.length, 0, 'Cable product serial numbers must be empty array');
    console.log('✔ PASS: Cable product correctly locked to non-serialized with 0 serial numbers.');

    // TEST 4: Generate serial numbers endpoint
    console.log('\n[Test 4] Generate serial numbers endpoint...');
    const { req: req4, res: res4, getStatusCode: codeRes4, getResponseData: data4 } = mockReqRes(
      {},
      {},
      { code: 'ASI-GEN', qty: '4' }
    );
    stockController.generateSerialNumbersEndpoint(req4, res4);
    assert.strictEqual(codeRes4(), 200, 'Should return 200');
    assert.strictEqual(data4().success, true, 'Should succeed');
    assert.strictEqual(data4().serialNumbers.length, 4, 'Should generate 4 serial numbers');
    assert(data4().serialNumbers[0].startsWith('ASI-GEN-'), 'Serial numbers must have code prefix');
    console.log('✔ PASS: Serial numbers generator endpoint generated 4 sequential serials:', data4().serialNumbers);

    // TEST 5: Product Update with Serial Numbers
    console.log('\n[Test 5] Product update with serial numbers synchronization...');
    const { req: req5, res: res5, getStatusCode: codeRes5, getResponseData: data5 } = mockReqRes(
      {
        cost: 4000,
        dealerPercentage: 10,
        dealerPrice: 4400,
        mrpPercentage: 20,
        mrp: 4840,
        gst: 18,
        stock: 4,
        alertQuantity: 2,
        serialized: true,
        serialNumbers: [`${code1}-SN-001`, `${code1}-SN-002`, `${code1}-SN-003`, `${code1}-SN-004`]
      },
      { id: prod1.id }
    );
    stockController.updateEntity(req5, res5, 'products');
    assert.strictEqual(codeRes5(), 200, 'Should update product with 200 OK');
    const updatedProd1 = data5().product || data5().item;
    assert.strictEqual(updatedProd1.stock, 4, 'Stock should be updated to 4');
    assert.strictEqual(updatedProd1.serialNumbers.length, 4, 'Product should have 4 serial numbers');
    console.log('✔ PASS: Product update correctly synced stock to 4 with updated serial numbers.');

    console.log('\n=== ALL ADD PRODUCT SERIALS & OPENING STOCK TESTS PASSED (100%) ===');
  } finally {
    // Restore backup
    fs.writeFileSync(stocksFile, stocksBackup, 'utf8');
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
