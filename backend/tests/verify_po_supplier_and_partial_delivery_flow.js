/**
 * Verification Test Suite: PO Supplier Management, Strict 10-Digit Phone, and Partial vs Full Delivery Flow
 */

const assert = require('assert');
const path = require('path');
const supplierController = require('../controllers/supplierController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const crmStore = require('../data/crmStore');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('=== STARTING PO, SUPPLIER & DELIVERY FLOW AUDIT ===\n');

  // TEST 1: Strict 10-Digit Phone on Supplier Creation
  console.log('[Test 1] Testing Strict 10-Digit Phone Validation on Supplier Creation...');
  
  // 1a: 9 digits -> Should Fail
  const reqShort = {
    body: { companyName: 'Short Phone Supplier', phone: '987654321' }
  };
  const resShort = mockRes();
  supplierController.createSupplier(reqShort, resShort);
  assert.strictEqual(resShort.statusCode, 400, 'Should reject 9-digit phone');
  assert.strictEqual(resShort.body.success, false);
  console.log('  ✓ Correctly rejected 9-digit phone:', resShort.body.message);

  // 1b: 11 digits -> Should Fail
  const reqLong = {
    body: { companyName: 'Long Phone Supplier', phone: '98765432101' }
  };
  const resLong = mockRes();
  supplierController.createSupplier(reqLong, resLong);
  assert.strictEqual(resLong.statusCode, 400, 'Should reject 11-digit phone');
  assert.strictEqual(resLong.body.success, false);
  console.log('  ✓ Correctly rejected 11-digit phone:', resLong.body.message);

  // 1c: Formatted 10 digits with space/dashes -> Should succeed and clean to 10 digits
  const uniqueName = `Clean Phone Supplier Ltd ${Date.now()}`;
  const reqValid = {
    body: {
      companyName: uniqueName,
      contactPerson: 'Alice Green',
      phone: '98765 43210', // Formatted input with space (10 digits)
      email: 'alice@cleanphone.com',
      city: 'Chennai'
    }
  };
  const resValid = mockRes();
  supplierController.createSupplier(reqValid, resValid);
  assert.strictEqual(resValid.statusCode, 201, 'Should create supplier');
  assert.strictEqual(resValid.body.success, true);
  const createdSupplier = resValid.body.data;
  assert.strictEqual(createdSupplier.phone, '9876543210', 'Phone must be stripped to exactly 10 digits');
  console.log('  ✓ Created supplier with clean 10-digit phone:', createdSupplier.supplierId, '->', createdSupplier.phone);

  // TEST 2: Supplier Editing & Phone Validation
  console.log('\n[Test 2] Testing Supplier Edit & Phone Validation...');
  const reqEditInvalid = {
    params: { id: createdSupplier.id },
    body: { phone: '9988' }
  };
  const resEditInvalid = mockRes();
  supplierController.updateSupplier(reqEditInvalid, resEditInvalid);
  assert.strictEqual(resEditInvalid.statusCode, 400, 'Should reject short phone on edit');
  console.log('  ✓ Correctly rejected short phone on edit:', resEditInvalid.body.message);

  const reqEditValid = {
    params: { id: createdSupplier.id },
    body: { contactPerson: 'Alice Blue Updated', phone: '9123456789' }
  };
  const resEditValid = mockRes();
  supplierController.updateSupplier(reqEditValid, resEditValid);
  assert.strictEqual(resEditValid.statusCode, 200, 'Should successfully update supplier');
  assert.strictEqual(resEditValid.body.data.contactPerson, 'Alice Blue Updated');
  assert.strictEqual(resEditValid.body.data.phone, '9123456789');
  console.log('  ✓ Successfully edited supplier with 10-digit phone:', resEditValid.body.data.contactPerson, resEditValid.body.data.phone);

  // TEST 3: Supplier Deletion & Protection
  console.log('\n[Test 3] Testing Supplier Deletion Protection...');
  // 3a: Delete newly created supplier with NO orders -> Should Succeed
  const reqDelValid = { params: { id: createdSupplier.id } };
  const resDelValid = mockRes();
  supplierController.deleteSupplier(reqDelValid, resDelValid);
  assert.strictEqual(resDelValid.statusCode, 200, 'Should delete supplier without orders');
  assert.strictEqual(resDelValid.body.success, true);
  console.log('  ✓ Successfully deleted unlinked supplier:', resDelValid.body.message);

  // 3b: Deletion of supplier WITH active purchase order -> Should be prevented
  const existingPo = (crmStore.purchaseOrders || []).find((p) => p.supplierId);
  if (existingPo) {
    const reqDelBlocked = { params: { id: existingPo.supplierId } };
    const resDelBlocked = mockRes();
    supplierController.deleteSupplier(reqDelBlocked, resDelBlocked);
    assert.strictEqual(resDelBlocked.statusCode, 400, 'Must block deletion of supplier with purchase orders');
    console.log('  ✓ Protected supplier deletion:', resDelBlocked.body.message);
  }

  // TEST 4: Partial vs Full Delivery Differentiation
  console.log('\n[Test 4] Testing PO Goods Receipt Partial vs Full Delivery flow...');
  
  // Create a supplier and PO for delivery testing
  const reqSupForPo = {
    body: { companyName: `Delivery Test Tech ${Date.now()}`, phone: '9840011223' }
  };
  const resSupForPo = mockRes();
  supplierController.createSupplier(reqSupForPo, resSupForPo);
  const poSup = resSupForPo.body.data;

  const reqCreatePo = {
    headers: { 'x-user-id': 'USR-001' },
    body: {
      supplierId: poSup.id,
      supplierSnapshot: {
        id: poSup.id,
        companyName: poSup.companyName,
        phone: poSup.phone
      },
      items: [
        {
          productId: 'CAM-IPC-001',
          productCode: 'CAM-IPC-001',
          productName: 'IPC 2MP Bullet Camera',
          orderedQty: 10,
          rate: 3000,
          gstRate: 18,
          serialized: false
        }
      ],
      status: 'SENT'
    }
  };
  const resCreatePo = mockRes();
  purchaseOrderController.createPurchaseOrder(reqCreatePo, resCreatePo);
  assert.strictEqual(resCreatePo.statusCode, 201, 'Should create PO');
  const testPo = resCreatePo.body.data;
  console.log(`  ✓ Created PO ${testPo.id} with 10 units ordered`);

  // PARTIAL INWARD: Receive 4 out of 10 units
  console.log('  Testing Partial Goods Receipt (4 units of 10)...');
  const now = Date.now();
  const reqPartial = {
    headers: { 'x-user-id': 'USR-001' },
    params: { id: testPo.id },
    body: {
      receivedDate: '2026-10-29',
      receivedBy: 'Store Officer Auto',
      items: [
        {
          productId: 'CAM-IPC-001',
          productCode: 'CAM-IPC-001',
          receiveNow: 4,
          unitRate: 3000,
          serialNumbers: [
            `SN-AUTO-A-${now}-1`,
            `SN-AUTO-A-${now}-2`,
            `SN-AUTO-A-${now}-3`,
            `SN-AUTO-A-${now}-4`
          ]
        }
      ]
    }
  };
  const resPartial = mockRes();
  purchaseOrderController.receiveGoods(reqPartial, resPartial);
  if (resPartial.statusCode !== 200) console.log('Partial receive error:', resPartial.body);
  assert.strictEqual(resPartial.statusCode, 200, 'Should confirm partial receipt');
  assert.strictEqual(resPartial.body.deliveryType, 'PARTIAL', 'Delivery type must be PARTIAL');
  assert.strictEqual(resPartial.body.grn.deliveryType, 'PARTIAL', 'GRN deliveryType must be PARTIAL');
  assert.strictEqual(resPartial.body.purchaseOrder.status, 'PARTIALLY_RECEIVED', 'PO status must become PARTIALLY_RECEIVED');
  assert.strictEqual(resPartial.body.purchaseOrder.totalReceivedQty, 4);
  assert.strictEqual(resPartial.body.purchaseOrder.totalPendingQty, 6);
  console.log('  ✓ Partial Delivery correctly stamped:');
  console.log('    • GRN ID:', resPartial.body.grn.id);
  console.log('    • GRN Delivery Type:', resPartial.body.grn.deliveryType);
  console.log('    • PO Status:', resPartial.body.purchaseOrder.status);
  console.log('    • Received / Pending:', `${resPartial.body.purchaseOrder.totalReceivedQty} / ${resPartial.body.purchaseOrder.totalPendingQty}`);

  // FULL INWARD: Receive remaining 6 units
  console.log('  Testing Full Goods Receipt (remaining 6 units)...');
  const reqFull = {
    headers: { 'x-user-id': 'USR-001' },
    params: { id: testPo.id },
    body: {
      receivedDate: '2026-10-29',
      receivedBy: 'Store Officer Auto',
      items: [
        {
          productId: 'CAM-IPC-001',
          productCode: 'CAM-IPC-001',
          receiveNow: 6,
          unitRate: 3000,
          serialNumbers: [
            `SN-AUTO-B-${now}-1`,
            `SN-AUTO-B-${now}-2`,
            `SN-AUTO-B-${now}-3`,
            `SN-AUTO-B-${now}-4`,
            `SN-AUTO-B-${now}-5`,
            `SN-AUTO-B-${now}-6`
          ]
        }
      ]
    }
  };
  const resFull = mockRes();
  purchaseOrderController.receiveGoods(reqFull, resFull);
  assert.strictEqual(resFull.statusCode, 200, 'Should confirm full receipt');
  assert.strictEqual(resFull.body.deliveryType, 'FULL', 'Delivery type must be FULL');
  assert.strictEqual(resFull.body.grn.deliveryType, 'FULL', 'GRN deliveryType must be FULL');
  assert.strictEqual(resFull.body.purchaseOrder.status, 'RECEIVED', 'PO status must become RECEIVED');
  assert.strictEqual(resFull.body.purchaseOrder.totalReceivedQty, 10);
  assert.strictEqual(resFull.body.purchaseOrder.totalPendingQty, 0);
  console.log('  ✓ Full Delivery correctly stamped:');
  console.log('    • GRN ID:', resFull.body.grn.id);
  console.log('    • GRN Delivery Type:', resFull.body.grn.deliveryType);
  console.log('    • PO Status:', resFull.body.purchaseOrder.status);
  console.log('    • Received / Pending:', `${resFull.body.purchaseOrder.totalReceivedQty} / ${resFull.body.purchaseOrder.totalPendingQty}`);

  console.log('\n======================================================');
  console.log('ALL PO, SUPPLIER & DELIVERY AUDIT TESTS PASSED (100%)!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
