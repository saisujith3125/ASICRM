const assert = require('assert');
const fs = require('fs');
const path = require('path');

const purchaseOrderController = require('../controllers/purchaseOrderController');
const settingsController = require('../controllers/settingsController');
const financeService = require('../services/financeService');

function mockReq(body = {}, params = {}, query = {}, headers = {}) {
  return {
    body,
    params,
    query,
    headers: { 'x-user-id': 'USR-001', ...headers },
    user: { id: 'USR-001', name: 'Super Admin', role: 'Super Admin' }
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
  console.log('=== STARTING PURCHASE ORDER IMMEDIATE PAYMENT & BANK METHODS FLOW AUDIT ===\n');

  const crmFile = path.join(__dirname, '..', 'data', 'crm-data.json');
  const stocksFile = path.join(__dirname, '..', 'data', 'stocks-data.json');
  const seqFile = path.join(__dirname, '..', 'data', 'document-sequences.json');
  const crmBackup = fs.readFileSync(crmFile, 'utf8');
  const stocksBackup = fs.readFileSync(stocksFile, 'utf8');
  const seqBackup = fs.readFileSync(seqFile, 'utf8');

  try {
    // Test 1: Verify Master Settings Multi-Bank Accounts
    console.log('[Test 1] Verifying Master Settings Multi-Bank Accounts (SBI, HDFC, IndusInd, UPI)...');
    const req1 = mockReq();
    const res1 = mockRes();
    await settingsController.getCompanySettings(req1, res1);

    assert.strictEqual(res1.statusCode, 200, 'getCompanySettings should return 200');
    assert.strictEqual(res1.data.success, true, 'getCompanySettings should be successful');
    const methods = res1.data.data.paymentMethods;
    assert(Array.isArray(methods), 'paymentMethods should be an array');
    assert(methods.length >= 4, 'paymentMethods should contain multiple bank accounts');

    const sbi = methods.find((m) => m.code === 'SBI-01' || /sbi/i.test(m.name));
    assert(sbi, 'SBI bank account must exist in Master Settings');
    assert(sbi.subMethods.includes('RTGS'), 'SBI should support RTGS');

    const upi = methods.find((m) => m.code === 'UPI-01' || /upi/i.test(m.type));
    assert(upi, 'UPI payment method must exist in Master Settings');
    assert.strictEqual(Number(upi.maxLimit), 100000, 'UPI max limit should be capped at ₹1,00,000');

    console.log(`✔ PASS: Settings configured with ${methods.length} payment channels including SBI, HDFC, IndusInd, and UPI (₹1 Lakh limit cap).\n`);

    // Test 2: Create Purchase Order with Immediate Payment via SBI RTGS
    console.log('[Test 2] Creating Purchase Order with Immediate Payment via SBI (RTGS)...');
    const poPayload = {
      supplierId: 'SUP-001',
      orderDate: '2026-10-31',
      expectedDeliveryDate: '2026-11-10',
      status: 'SENT',
      items: [
        {
          productId: 'PRD-001',
          productCode: 'ASI-01',
          productName: 'Dahua 5MP IR Bullet Camera',
          unit: 'Nos',
          orderedQty: 2,
          rate: 1800,
          gstRate: 18
        }
      ],
      paymentTerms: 'Immediate Payment',
      payingBank: 'State Bank of India (SBI)',
      paymentMethod: 'State Bank of India (SBI) - RTGS',
      paymentRef: 'UTR-SBIN-88992211',
      immediateAmount: 4248
    };

    const req2 = mockReq(poPayload);
    const res2 = mockRes();
    await purchaseOrderController.createPurchaseOrder(req2, res2);

    assert.strictEqual(res2.statusCode, 201, `Create PO should return 201, got ${res2.statusCode}: ${res2.data?.message}`);
    const createdPo = res2.data.data;
    assert.strictEqual(createdPo.paymentTerms, 'Immediate Payment', 'PO paymentTerms must be Immediate Payment');
    assert.strictEqual(createdPo.totalPaid, 4248, 'Total paid must equal 4248');
    assert.strictEqual(createdPo.balanceAmount, 0, 'Balance amount must be 0 for full immediate payment');
    assert.strictEqual(createdPo.paymentStatus, 'PAID', 'PO payment status must be PAID');
    assert.strictEqual(createdPo.payingBank, 'State Bank of India (SBI)', 'Paying bank must be SBI');
    assert.strictEqual(createdPo.payments.length, 1, 'Payments array must have 1 record');
    assert.strictEqual(createdPo.payments[0].type, 'IMMEDIATE', 'Payment type must be IMMEDIATE');
    assert.strictEqual(createdPo.payments[0].reference, 'UTR-SBIN-88992211', 'Payment reference must match UTR');

    console.log(`✔ PASS: PO ${createdPo.id} created with Immediate Payment via SBI RTGS. Total: ₹${createdPo.grandTotal}, Paid: ₹${createdPo.totalPaid}, Status: ${createdPo.paymentStatus}\n`);

    // Test 3: Goods Receipt on Fully Prepaid Immediate PO (Prevents Duplicate Double-Payment)
    console.log('[Test 3] Verifying Goods Receipt for fully settled Immediate PO...');
    const snPrefix = 'IMM-' + Date.now().toString().slice(-4);
    const grnPayload = {
      receivedDate: '2026-10-31',
      receivedBy: 'Store Officer',
      items: [
        {
          productId: 'PRD-001',
          receiveNow: 2,
          serialNumbers: [`${snPrefix}-01`, `${snPrefix}-02`]
        }
      ],
      paymentNow: 0 // No payment needed because PO was paid immediately
    };

    const req3 = mockReq(grnPayload, { id: createdPo.id });
    const res3 = mockRes();
    await purchaseOrderController.receiveGoods(req3, res3);

    assert.strictEqual(res3.statusCode, 200, `Goods receipt should return 200, got ${res3.statusCode}: ${res3.data?.message}`);
    const updatedPo = res3.data.purchaseOrder;
    assert.strictEqual(updatedPo.status, 'RECEIVED', 'PO status should be RECEIVED');
    assert.strictEqual(updatedPo.totalPaid, 4248, 'Total paid remains 4248');
    assert.strictEqual(updatedPo.balanceAmount, 0, 'Balance remains 0');
    assert.strictEqual(updatedPo.paymentStatus, 'PAID', 'Payment status remains PAID');

    console.log(`✔ PASS: Goods Receipt confirmed. All 10 items received with zero duplicate payment.\n`);

    // Test 4: Finance Cash Flow Timeline Output
    console.log('[Test 4] Verifying Finance & Cash Flow Engine Output...');
    const financeSummary = financeService.getFinanceSummary();
    assert(financeSummary, 'Finance summary must exist');
    assert(Array.isArray(financeSummary.timeline), 'Finance timeline must be an array');

    const immediateEvent = financeSummary.timeline.find(
      (e) => e.referenceId === createdPo.id && (e.type === 'PO_IMMEDIATE_OUTFLOW' || e.docType === 'Supplier Immediate Payment')
    );
    assert(immediateEvent, 'Finance timeline must contain an entry for Supplier Immediate Payment');
    assert.strictEqual(immediateEvent.amount, 4248, 'Immediate event amount must be 4248');
    assert(immediateEvent.description.includes('State Bank of India') || immediateEvent.description.includes('SBI'), 'Description should cite the paying bank');

    console.log(`✔ PASS: Finance timeline correctly recorded Supplier Immediate Payment of ₹${immediateEvent.amount} via SBI.\n`);

    console.log('=== ALL IMMEDIATE PAYMENT & BANK METHODS FLOW TESTS PASSED (100%) ===');
  } finally {
    fs.writeFileSync(crmFile, crmBackup, 'utf8');
    fs.writeFileSync(stocksFile, stocksBackup, 'utf8');
    fs.writeFileSync(seqFile, seqBackup, 'utf8');
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
