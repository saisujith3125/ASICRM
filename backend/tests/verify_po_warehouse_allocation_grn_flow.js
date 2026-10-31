const assert = require('assert');
const fs = require('fs');
const path = require('path');

const purchaseOrderController = require('../controllers/purchaseOrderController');
const warehouseController = require('../controllers/warehouseController');

const crmFile = path.join(__dirname, '..', 'data', 'crm-data.json');
const stocksFile = path.join(__dirname, '..', 'data', 'stocks-data.json');
const seqFile = path.join(__dirname, '..', 'data', 'document-sequences.json');

function mockReq(body = {}, params = {}, query = {}, headers = {}) {
  return {
    body,
    params,
    query,
    headers: { 'x-user-id': 'USR-001', ...headers },
    user: { id: 'USR-001', name: 'Logistics Officer', role: 'Super Admin' }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  return res;
}

async function runAudit() {
  console.log('=== STARTING PURCHASE ORDER WAREHOUSE ALLOCATION (GRN) FLOW AUDIT ===\n');

  const crmBackup = fs.readFileSync(crmFile, 'utf8');
  const stocksBackup = fs.readFileSync(stocksFile, 'utf8');
  const seqBackup = fs.readFileSync(seqFile, 'utf8');

  try {
    // 1. Create Purchase Order with 2 line items (Camera & Cable)
    console.log('[Test 1] Creating Purchase Order with 2 line items...');
    const uniqueSuffix = Date.now().toString().slice(-4);
    const poPayload = {
      supplierId: 'SUP-001',
      orderDate: '2026-10-31',
      expectedDeliveryDate: '2026-11-15',
      status: 'SENT',
      paymentTerms: 'Immediate Payment',
      items: [
        {
          productId: 'PRD-001',
          productCode: 'ASI-01',
          productName: 'Dahua 5MP IR Bullet Camera',
          unit: 'Nos',
          orderedQty: 1,
          rate: 2000,
          cost: 2000,
          gstRate: 18,
          serialized: true
        },
        {
          productId: 'PRD-006',
          productCode: 'CAB-UTP-001',
          productName: 'D-Link Cat6 UTP 305M Solid Cable Roll',
          unit: 'Roll',
          orderedQty: 10,
          rate: 1500,
          cost: 1500,
          gstRate: 18,
          serialized: false
        }
      ]
    };

    const req1 = mockReq(poPayload);
    const res1 = mockRes();
    await purchaseOrderController.createPurchaseOrder(req1, res1);

    assert.strictEqual(res1.statusCode, 201, `Create PO should return 201, got ${res1.statusCode}: ${res1.data?.message}`);
    const po = res1.data.data;
    const poId = po.id;
    console.log(`✔ PASS: PO created successfully: ${poId}\n`);

    // 2. Inward Goods with Physical Warehouse & Storage Bin Allocations
    console.log('[Test 2] Receiving goods with destination warehouse WH-001 and specific bin putaway coordinates...');
    const testSerial = `WH-SN-${Date.now().toString().slice(-6)}`;
    const camAlloc = {
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

    const cableAlloc = {
      warehouseId: 'WH-001',
      warehouseName: 'Main Central Hub',
      floor: 'Floor 2 (High-Value Storage)',
      rack: 'Rack D (Networking & Switches)',
      shelf: 'Shelf 2',
      box: 'Box D2-01 (Cat6 Cable Reels 305M)',
      boxCode: 'BX-16',
      locationCode: 'WH-CHN-01-FL-02-RK-D-SH-02-BX-16',
      binLocation: 'Main Central Hub › Floor 2 (High-Value Storage) › Rack D (Networking & Switches) › Shelf 2 › Box D2-01 (Cat6 Cable Reels 305M)'
    };

    const receivePayload = {
      receivedDate: '2026-10-31',
      receivedBy: 'Store Officer',
      warehouseId: 'WH-001',
      warehouseName: 'Main Central Hub',
      notes: 'Inward receipt with warehouse putaway allocation',
      paymentNow: 1500,
      paymentMode: 'HDFC Bank - RTGS',
      payingBank: 'HDFC Bank',
      paymentRef: `UTR-GRN-${uniqueSuffix}`,
      items: [
        {
          productId: 'PRD-001',
          productCode: 'ASI-01',
          receiveNow: 1,
          unitRate: 2000,
          serialNumbers: [testSerial],
          warehouseLocation: camAlloc
        },
        {
          productId: 'PRD-006',
          productCode: 'CAB-UTP-001',
          receiveNow: 10,
          unitRate: 1500,
          serialNumbers: [],
          warehouseLocation: cableAlloc
        }
      ]
    };

    const req2 = mockReq(receivePayload, { id: poId });
    const res2 = mockRes();
    await purchaseOrderController.receiveGoods(req2, res2);

    assert.strictEqual(res2.statusCode, 200, `receiveGoods should return 200, got ${res2.statusCode}: ${res2.data?.message}`);
    assert.strictEqual(res2.data.success, true, 'receiveGoods must succeed');
    const grnId = res2.data.grnId || res2.data.grn?.id;
    assert(grnId, 'GRN ID must be returned');
    console.log(`✔ PASS: Goods receipt processed. GRN ID: ${grnId}\n`);

    // 3. Verify GRN Record in crm-data.json
    console.log('[Test 3] Verifying GRN persistence with warehouseId and item-level coordinates...');
    const crmData = JSON.parse(fs.readFileSync(crmFile, 'utf8'));
    const grn = (crmData.goodsReceipts || []).find(g => g.id === grnId);
    assert(grn, 'GRN must exist in goodsReceipts');
    assert.strictEqual(grn.warehouseId, 'WH-001', 'GRN warehouseId must be WH-001');
    assert.strictEqual(grn.warehouseName, 'Main Central Hub', 'GRN warehouseName must be Main Central Hub');
    assert.strictEqual(grn.items.length, 2, 'GRN must have 2 inward items');
    assert.strictEqual(grn.items[0].warehouseLocation.locationCode, camAlloc.locationCode);
    assert.strictEqual(grn.items[1].warehouseLocation.locationCode, cableAlloc.locationCode);
    console.log('✔ PASS: GRN stamped with destination warehouse and putaway coordinates.\n');

    // 4. Verify product warehouseLocation & stock in stocks-data.json
    console.log('[Test 4] Verifying physical inventory and product warehouseLocation updates...');
    const stocksData = JSON.parse(fs.readFileSync(stocksFile, 'utf8'));
    const updatedCam = stocksData.products.find(p => p.id === 'PRD-001');
    const updatedCable = stocksData.products.find(p => p.id === 'PRD-006');

    assert(updatedCam.warehouseLocation, 'Camera must have warehouseLocation');
    assert.strictEqual(updatedCam.warehouseLocation.warehouseId, 'WH-001');
    assert.strictEqual(updatedCam.warehouseLocation.locationCode, camAlloc.locationCode);

    assert(updatedCable.warehouseLocation, 'Cable must have warehouseLocation');
    assert.strictEqual(updatedCable.warehouseLocation.warehouseId, 'WH-001');
    assert.strictEqual(updatedCable.warehouseLocation.locationCode, cableAlloc.locationCode);
    console.log('✔ PASS: Catalog products updated with designated warehouse and bin codes.\n');

    // 5. Verify Serial Metadata and Inventory Transactions
    console.log('[Test 5] Verifying Serial Metadata and Inventory Transactions tagging...');
    const meta = updatedCam.serialMetadata?.[testSerial];
    assert(meta, `Serial metadata for ${testSerial} must exist on product`);
    assert.strictEqual(meta.warehouse, 'Main Central Hub', 'Serial metadata must have warehouse');
    assert.strictEqual(meta.location, camAlloc.locationCode, 'Serial metadata must have location code');

    const txns = stocksData.inventoryTransactions || [];
    const camTxn = txns.find(t => t.referenceId === grnId && t.productId === 'PRD-001');
    const cableTxn = txns.find(t => t.referenceId === grnId && t.productId === 'PRD-006');
    assert(camTxn, 'Inward transaction for Camera must exist');
    assert.strictEqual(camTxn.warehouseId, 'WH-001');
    assert.strictEqual(camTxn.binLocation, camAlloc.binLocation);
    assert(cableTxn, 'Inward transaction for Cable must exist');
    assert.strictEqual(cableTxn.warehouseId, 'WH-001');
    assert.strictEqual(cableTxn.binLocation, cableAlloc.binLocation);
    console.log('✔ PASS: Serial number and transaction records tagged to Warehouse and Bin.\n');

    // 6. Verify Warehouse Occupancy Dashboard
    console.log('[Test 6] Verifying Warehouse Occupancy Dashboard reflection...');
    const resWh = mockRes();
    await warehouseController.getAllWarehouses(mockReq(), resWh);
    assert.strictEqual(resWh.statusCode, 200);
    const whList = resWh.data.data;
    const centralWh = whList.find(w => w.id === 'WH-001');
    assert(centralWh, 'WH-001 must exist');
    assert(centralWh.totalStockUnits > 0, 'Central warehouse total stock units should be positive');
    console.log(`✔ PASS: Warehouses API reflects live occupancy (${centralWh.occupancyRate}% occupied, ${centralWh.totalStockUnits} stock units).\n`);

    console.log('=== ALL 6 TESTS PASSED WITH 100% SUCCESS ===');
  } finally {
    // Restore clean initial data
    fs.writeFileSync(crmFile, crmBackup, 'utf8');
    fs.writeFileSync(stocksFile, stocksBackup, 'utf8');
    fs.writeFileSync(seqFile, seqBackup, 'utf8');
    console.log('\n[Cleanup] Test data safely rolled back to clean baseline state.');
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
