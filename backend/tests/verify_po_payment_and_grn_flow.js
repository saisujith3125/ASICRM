const assert = require('assert');
const path = require('path');
const fs = require('fs');

const purchaseOrderController = require('../controllers/purchaseOrderController');
const { getFinanceSummary } = require('../services/financeService');
const { purchaseOrders, goodsReceipts } = require('../data/crmStore');

function mockReqRes(body = {}, params = {}, query = {}, headers = { 'x-user-id': 'USR-001' }) {
  let statusCode = 200;
  let responseData = null;
  const req = { body, params, query, headers, user: { id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN' } };
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
  console.log('=== STARTING PURCHASE ORDER PAYMENT & GRN SETTLEMENT FLOW AUDIT ===\n');

  const crmFile = path.join(__dirname, '..', 'data', 'crm-data.json');
  const stocksFile = path.join(__dirname, '..', 'data', 'stocks-data.json');
  const seqFile = path.join(__dirname, '..', 'data', 'document-sequences.json');

  const crmBackup = fs.readFileSync(crmFile, 'utf8');
  const stocksBackup = fs.readFileSync(stocksFile, 'utf8');
  const seqBackup = fs.readFileSync(seqFile, 'utf8');

  try {
    // TEST 1: PO Creation with Partial Advance (₹2,100 on ₹21,240 PO)
    console.log('[Test 1] PO Creation with Advance Payment (₹2,100)...');
    const { req: req1, res: res1, getStatusCode: code1, getResponseData: data1 } = mockReqRes({
      supplierId: 'SUP-001',
      orderDate: '2026-10-31',
      expectedDeliveryDate: '2026-11-15',
      status: 'SENT',
      paymentTerms: 'Advance 50% + Balance on Delivery',
      advanceAmount: 2100,
      advancePaymentMode: 'Bank Transfer',
      advancePaymentRef: 'UTR-ADV-998877',
      items: [
        {
          productId: 'PRD-001',
          productCode: 'ASI-01',
          productName: 'Cat 6 Cable 305m',
          unit: 'Roll',
          hsnSac: '85444990',
          orderedQty: 10,
          rate: 1800,
          gstRate: 18
        }
      ]
    });

    purchaseOrderController.createPurchaseOrder(req1, res1);
    assert.strictEqual(code1(), 201, 'Should create PO successfully');
    const createdPo1 = data1().data;
    assert.strictEqual(createdPo1.advanceAmount, 2100, 'Advance amount must be 2100');
    assert.strictEqual(createdPo1.totalPaid, 2100, 'Total paid must equal advance 2100');
    assert.strictEqual(createdPo1.balanceAmount, createdPo1.grandTotal - 2100, 'Balance must be GrandTotal - 2100');
    assert.strictEqual(createdPo1.paymentStatus, 'PARTIALLY_PAID', 'Payment status should be PARTIALLY_PAID');
    assert.strictEqual(createdPo1.payments.length, 1, 'Should have 1 payment record for Advance');
    assert.strictEqual(createdPo1.payments[0].type, 'ADVANCE');
    assert.strictEqual(createdPo1.payments[0].amount, 2100);
    console.log(`✔ PASS: PO ${createdPo1.id} created with ₹2,100 advance. Grand Total: ₹${createdPo1.grandTotal}, Balance Due: ₹${createdPo1.balanceAmount}`);

    // TEST 2: Receive Goods with Payment on Receipt (Batch Payment ₹9,000)
    console.log('\n[Test 2] Goods Receipt with Payment on Receipt (₹9,000)...');
    const { req: req2, res: res2, getStatusCode: code2, getResponseData: data2 } = mockReqRes(
      {
        receivedDate: '2026-10-31',
        receivedBy: 'Store Officer',
        notes: 'Cartons in good condition',
        items: [
          {
            productId: 'PRD-001',
            receiveNow: 5,
            unitRate: 1800,
            serialNumbers: ['SN-BATCH1-01', 'SN-BATCH1-02', 'SN-BATCH1-03', 'SN-BATCH1-04', 'SN-BATCH1-05']
          }
        ],
        paymentNow: 9000,
        paymentMode: 'Bank Transfer',
        paymentRef: 'UTR-GRN-112233'
      },
      { id: createdPo1.id }
    );

    purchaseOrderController.receiveGoods(req2, res2);
    if (code2() !== 200) console.log('ERROR in Test 2:', data2());
    assert.strictEqual(code2(), 200, 'Should confirm goods receipt with 200 OK');
    const updatedPo1 = data2().purchaseOrder;
    assert.strictEqual(updatedPo1.totalPaid, 11100, 'Total paid must now be ₹11,100 (2100 adv + 9000 GRN)');
    assert.strictEqual(updatedPo1.balanceAmount, updatedPo1.grandTotal - 11100, 'Balance must be reduced to GrandTotal - 11100');
    assert.strictEqual(updatedPo1.payments.length, 2, 'Must have 2 payment records (Advance + GRN)');
    assert.strictEqual(updatedPo1.payments[1].type, 'GRN_PAYMENT');
    assert.strictEqual(updatedPo1.payments[1].amount, 9000);
    assert.strictEqual(data2().grn.payment.amount, 9000, 'GRN record must preserve payment details');
    console.log(`✔ PASS: Goods Receipt confirmed. Total Paid: ₹${updatedPo1.totalPaid}, Remaining Balance: ₹${updatedPo1.balanceAmount}`);

    // TEST 3: Receive Second Batch on Credit (Net 30 - ₹0 Payment Now)
    console.log('\n[Test 3] Receive Second Batch on Credit (No immediate payment)...');
    const { req: req3, res: res3, getStatusCode: code3, getResponseData: data3 } = mockReqRes(
      {
        receivedDate: '2026-11-01',
        receivedBy: 'Store Officer',
        notes: 'Final batch received',
        items: [
          {
            productId: 'PRD-001',
            receiveNow: 5,
            unitRate: 1800,
            serialNumbers: ['SN-BATCH2-01', 'SN-BATCH2-02', 'SN-BATCH2-03', 'SN-BATCH2-04', 'SN-BATCH2-05']
          }
        ],
        paymentNow: 0, // Pay later on credit
        paymentMode: 'Credit',
        paymentRef: ''
      },
      { id: createdPo1.id }
    );

    purchaseOrderController.receiveGoods(req3, res3);
    assert.strictEqual(code3(), 200, 'Should complete receipt with 200 OK');
    const finalPo1 = data3().purchaseOrder;
    assert.strictEqual(finalPo1.status, 'RECEIVED', 'PO should be fully RECEIVED');
    assert.strictEqual(finalPo1.totalPaid, 11100, 'Total paid must remain 11100');
    assert.strictEqual(finalPo1.balanceAmount, finalPo1.grandTotal - 11100, 'Remaining balance must still be due');
    console.log(`✔ PASS: Full delivery completed. PO Status: RECEIVED. Remaining Payable Due: ₹${finalPo1.balanceAmount}`);

    // TEST 4: Finance & Cash Flow Engine Synchronization
    console.log('\n[Test 4] Verifying Finance & Cash Flow Engine Output...');
    const financeData = getFinanceSummary();
    assert(financeData && financeData.kpis, 'Finance overview must return KPIs');
    console.log(`  • Committed PO Outflow: ₹${financeData.kpis.totalOutflowCommitted}`);
    console.log(`  • Actual Paid Supplier Outflow: ₹${financeData.kpis.totalPoPaidAmount}`);
    console.log(`  • Remaining Payables Pending: ₹${financeData.kpis.totalPayablesPending}`);
    assert(financeData.kpis.totalPoPaidAmount >= 11100, 'Actual cash outflow must track paid amount');
    assert(financeData.kpis.totalPayablesPending > 0, 'Remaining payables must be tracked');

    // Check timeline items
    const advTimelineItem = financeData.timeline.find(t => t.id === `PAY-ADV-${createdPo1.id}` || (t.referenceId === createdPo1.id && t.amount === 2100));
    assert(advTimelineItem, 'Timeline must contain Supplier Advance item');
    assert.strictEqual(advTimelineItem.direction, 'OUTFLOW');
    console.log('✔ PASS: Finance timeline successfully tracks distinct Supplier Advance & Outflow entries.');

    console.log('\n=== ALL PURCHASE ORDER PAYMENT & GRN FLOW TESTS PASSED (100%) ===');
  } finally {
    fs.writeFileSync(crmFile, crmBackup, 'utf8');
    fs.writeFileSync(stocksFile, stocksBackup, 'utf8');
    fs.writeFileSync(seqFile, seqBackup, 'utf8');
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
