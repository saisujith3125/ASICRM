const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Path to stocks-data.json
const DATA_FILE = path.join(__dirname, '..', 'data', 'stocks-data.json');

console.log('--- STARTING WAREHOUSE ALLOCATION FLOW VERIFICATION ---');

// Backup original data
const originalContent = fs.readFileSync(DATA_FILE, 'utf8');

try {
  const stockController = require('../controllers/stockController');
  const warehouseController = require('../controllers/warehouseController');

  // Mock req & res
  function createMockReqRes(body, params = {}, headers = {}) {
    let statusCode = 200;
    let resJson = null;
    const req = {
      body,
      params,
      headers: { 'x-user-id': 'USR-001', 'x-user-role': 'Admin', ...headers }
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resJson = data;
        return this;
      }
    };
    return { req, res, getStatus: () => statusCode, getJson: () => resJson };
  }

  // 1. TEST: Create Product with Custom Warehouse Allocation & Serial Numbers
  console.log('1. Testing Product Creation with custom storage bin and opening stock...');
  const testProdCode = `AI-CAM-${Date.now().toString().slice(-4)}`;
  const customBin = {
    warehouseId: 'WH-001',
    warehouseName: 'Main Central Hub',
    floor: 'Floor 1 (Ground Floor)',
    rack: 'Rack A (CCTV & Surveillance)',
    shelf: 'Shelf 1 (Bottom Tier)',
    box: 'Box A1-01 (Bullet Cameras)',
    boxCode: 'BX-01',
    locationCode: 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01',
    binLocation: 'Main Central Hub › Floor 1 (Ground Floor) › Rack A (CCTV & Surveillance) › Shelf 1 (Bottom Tier) › Box A1-01 (Bullet Cameras)'
  };

  const { req: createReq, res: createRes, getJson: getCreateJson } = createMockReqRes({
    code: testProdCode,
    name: 'Dahua 4K AI Ultra Bullet Camera',
    hsnSac: '85258900',
    categoryId: 'CAT-001', // IP Cameras
    subcategoryId: 'SUBCAT-001',
    brandId: 'BR-001',
    cost: 5000,
    dealerPercentage: 20,
    dealerPrice: 6000,
    mrpPercentage: 40,
    mrp: 7000,
    gst: 18,
    stock: 2,
    serialized: true,
    serialNumbers: [`SN-${testProdCode}-01`, `SN-${testProdCode}-02`],
    warehouseLocation: customBin,
    warehouseId: 'WH-001'
  });

  stockController.createEntity(createReq, createRes, 'products');
  const createResult = getCreateJson();
  if (!createResult || !createResult.success) {
    console.error('Create failed:', createResult);
  }

  assert(createResult && createResult.success, 'Create product should succeed');
  assert(createResult.product, 'Created product should be returned in response');
  const createdProd = createResult.product;

  assert.strictEqual(createdProd.code, testProdCode);
  assert.strictEqual(createdProd.stock, 2);
  assert.strictEqual(createdProd.warehouseLocation.warehouseId, 'WH-001');
  assert.strictEqual(createdProd.warehouseLocation.boxCode, 'BX-01');
  assert.strictEqual(createdProd.warehouseLocation.locationCode, 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01');
  console.log('   ✓ Product master has warehouseLocation assigned:', createdProd.warehouseLocation.binLocation);

  // Check serial metadata
  assert(createdProd.serialMetadata, 'serialMetadata should be initialized');
  assert(createdProd.serialMetadata[`SN-${testProdCode}-01`], 'Serial 1 metadata should exist');
  assert.strictEqual(createdProd.serialMetadata[`SN-${testProdCode}-01`].warehouse, 'Main Central Hub');
  assert.strictEqual(createdProd.serialMetadata[`SN-${testProdCode}-01`].location, 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01');
  console.log('   ✓ Serial metadata correctly stamped with warehouse and bin location');

  // Check inventory transaction TXN-INIT
  const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const initTxn = (savedData.inventoryTransactions || []).find((t) => t.id === `TXN-INIT-${createdProd.id}`);
  assert(initTxn, 'TXN-INIT transaction must exist');
  assert.strictEqual(initTxn.warehouseId, 'WH-001');
  assert.strictEqual(initTxn.locationCode, 'WH-CHN-01-FL-01-RK-A-SH-01-BX-01');
  assert(initTxn.binLocation.includes('Rack A'), 'TXN-INIT should include bin location path');
  console.log('   ✓ TXN-INIT recorded warehouseId and binLocation:', initTxn.binLocation);

  // 2. TEST: Check Warehouse Controller reflects the newly added product in its occupancy
  console.log('2. Testing Warehouse Controller occupancy reflection...');
  const { req: whReq, res: whRes, getJson: getWhJson } = createMockReqRes({});
  warehouseController.getAllWarehouses(whReq, whRes);
  const whResult = getWhJson();
  assert(whResult && whResult.success, 'getAllWarehouses should succeed');

  const wh1 = whResult.data.find((w) => w.id === 'WH-001');
  assert(wh1, 'WH-001 should exist');
  // Check if Box A1-01 has products allocated
  let foundInBin = false;
  wh1.layout.floors.forEach((fl) => {
    (fl.racks || []).forEach((rk) => {
      (rk.shelves || []).forEach((sh) => {
        (sh.boxes || []).forEach((bx) => {
          if (bx.name.includes('Bullet') || bx.code === 'BX-01') {
            const hasTestProd = (bx.assignedProducts || []).some((p) => p.code === testProdCode);
            if (hasTestProd) foundInBin = true;
          }
        });
      });
    });
  });
  assert(foundInBin, 'Product should be visible in Box A1-01 products list');
  console.log('   ✓ Product correctly reflected in WH-001 Box A1-01 in /api/warehouses!');

  // 3. TEST: Update Product Warehouse Allocation (Relocate to Rack B)
  console.log('3. Testing Product Update to relocate bin...');
  const updatedBin = {
    warehouseId: 'WH-001',
    warehouseName: 'Main Central Hub',
    floor: 'Floor 1 (Ground Floor)',
    rack: 'Rack B (Storage & Surveillance Disks)',
    shelf: 'Shelf 2 (Middle Tier)',
    box: 'Box B1-02 (2TB & 4TB Surveillance HDDs)',
    boxCode: 'BX-06',
    locationCode: 'WH-CHN-01-FL-01-RK-B-SH-02-BX-06',
    binLocation: 'Main Central Hub › Floor 1 (Ground Floor) › Rack B (Storage & Surveillance Disks) › Shelf 2 (Middle Tier) › Box B1-02 (2TB & 4TB Surveillance HDDs)'
  };

  console.log('Created product ID:', createdProd.id);
  const { req: updateReq, res: updateRes, getJson: getUpdateJson } = createMockReqRes({
    ...createdProd,
    stock: 3,
    serialNumbers: [`SN-${testProdCode}-01`, `SN-${testProdCode}-02`, `SN-${testProdCode}-03`],
    warehouseLocation: updatedBin
  }, { id: createdProd.id });

  stockController.updateEntity(updateReq, updateRes, 'products');
  const updateResult = getUpdateJson();
  if (!updateResult || !updateResult.success) {
    console.error('Update failed:', updateResult);
  }
  assert(updateResult && updateResult.success, 'Update product should succeed');
  const updatedProduct = updateResult.product;

  assert.strictEqual(updatedProduct.stock, 3);
  assert.strictEqual(updatedProduct.warehouseLocation.boxCode, 'BX-06');
  assert.strictEqual(updatedProduct.serialMetadata[`SN-${testProdCode}-03`].location, 'WH-CHN-01-FL-01-RK-B-SH-02-BX-06');
  console.log('   ✓ Product successfully relocated to:', updatedProduct.warehouseLocation.binLocation);
  console.log('   ✓ Newly added serial #3 stamped with updated location:', updatedProduct.serialMetadata[`SN-${testProdCode}-03`].location);

  // Check TXN-ADJ transaction
  const postUpdateData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const adjTxn = (postUpdateData.inventoryTransactions || []).find((t) => t.productId === createdProd.id && t.event === 'ADJUSTMENT');
  assert(adjTxn, 'TXN-ADJ transaction must exist');
  assert.strictEqual(adjTxn.quantity, 1);
  assert.strictEqual(adjTxn.locationCode, 'WH-CHN-01-FL-01-RK-B-SH-02-BX-06');
  console.log('   ✓ Stock adjustment TXN-ADJ stamped with relocated bin location');

  // 4. TEST: Auto-detect putaway bin for new item without explicit allocation
  console.log('4. Testing Auto-Detect putaway bin for cables...');
  const cableCode = `CBL-CAT6-${Date.now().toString().slice(-4)}`;
  const { req: cableReq, res: cableRes, getJson: getCableJson } = createMockReqRes({
    code: cableCode,
    name: 'D-Link Cat6 UTP Network Cable 305M Roll',
    hsnSac: '85444990',
    categoryId: 'CAT-004', // Cables
    subcategoryId: 'SUBCAT-005',
    brandId: 'BR-004',
    cost: 4500,
    dealerPercentage: 15,
    dealerPrice: 5175,
    mrpPercentage: 30,
    mrp: 5850,
    gst: 18,
    stock: 5,
    serialized: false,
    unit: 'Roll'
  });

  stockController.createEntity(cableReq, cableRes, 'products');
  const cableResult = getCableJson();
  assert(cableResult && cableResult.success, 'Cable product creation should succeed');
  assert(cableResult.product.warehouseLocation, 'Auto-detected warehouseLocation must be assigned');
  assert(cableResult.product.warehouseLocation.rack.includes('Networking') || cableResult.product.warehouseLocation.box.toLowerCase().includes('cable'), 'Cable should route to cable/networking bin');
  console.log('   ✓ Auto-detect mapped cable product to:', cableResult.product.warehouseLocation.binLocation);

  console.log('\n>>> ALL 4 WAREHOUSE ALLOCATION FLOW VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
} finally {
  // Restore original data
  fs.writeFileSync(DATA_FILE, originalContent, 'utf8');
  console.log('--- Original stocks-data.json restored ---');
}
