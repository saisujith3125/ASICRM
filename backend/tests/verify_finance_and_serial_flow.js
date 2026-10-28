/**
 * Verification Test Suite: Finance & Flow Control + Serial Number Unit Profit Tracking
 * Validates macro financial KPIs, inward & outward registers, unbilled DC watchdog,
 * and serial number lifecycle unit economics.
 */

const assert = require('assert');
const financeService = require('../services/financeService');

async function runTests() {
  console.log('=== STARTING ASICRM FINANCE & SERIAL NUMBER FLOW AUDIT ===\n');

  // TEST 1: Macro Finance Summary KPIs
  console.log('[Test 1] Testing Macro Finance Summary & Flow Control...');
  const summary = financeService.getFinanceSummary();
  assert(summary && summary.kpis, 'Finance summary should return KPIs');
  const { kpis } = summary;

  console.log(`  • Billed Inflow:        ₹${kpis.totalInflowBilled}`);
  console.log(`  • Cash Collected:       ₹${kpis.totalCashCollected}`);
  console.log(`  • Committed PO Outflow: ₹${kpis.totalOutflowCommitted}`);
  console.log(`  • Unbilled DC Value:    ₹${kpis.unbilledDcTotalValue} (${kpis.unbilledDcCount} DCs)`);
  console.log(`  • GST Output Collected: ₹${kpis.gstCollected}`);
  console.log(`  • GST Input Paid (ITC): ₹${kpis.gstPaid}`);

  assert(kpis.totalInflowBilled > 0, 'Total inflow should be positive');
  assert(kpis.totalOutflowCommitted > 0, 'Total PO outflow should be positive');
  assert(kpis.unbilledDcCount > 0, 'Should detect unbilled Delivery Challans');
  assert(kpis.unbilledDcTotalValue > 0, 'Unbilled DC value should be positive');
  console.log('✓ PASS: Macro Finance KPIs and calculations verified.\n');

  // TEST 2: Unbilled Delivery Challans Watchdog
  console.log('[Test 2] Testing Unbilled DC Watchdog (Revenue Leakage Protection)...');
  const unbilledList = summary.unbilledDcs;
  assert(Array.isArray(unbilledList) && unbilledList.length > 0, 'Unbilled DCs list should be populated');

  const unbilledDc = unbilledList.find((d) => d.challanId === 'DC/002/2026');
  assert(unbilledDc, 'DC/002/2026 must be flagged as unbilled');
  assert.strictEqual(unbilledDc.customerName, 'Apex Technologies Pvt Ltd');
  assert(unbilledDc.totalValue > 50000, `DC/002 total value (${unbilledDc.totalValue}) should include all items`);
  console.log(`  • Flagged Unbilled DC: ${unbilledDc.challanId} for ${unbilledDc.customerName} - Unbilled Exposure: ₹${unbilledDc.totalValue}`);
  console.log('✓ PASS: Unbilled DC watchdog accurately detects delivered unbilled revenue.\n');

  // TEST 3: Inward Register Validation
  console.log('[Test 3] Testing Inward Register (PO Receipts & GRNs)...');
  const inwardRegister = financeService.getInwardRegister();
  assert(Array.isArray(inwardRegister) && inwardRegister.length > 0, 'Inward register must contain records');

  const sampleGrn = inwardRegister.find((r) => r.referenceId === 'GRN-001');
  assert(sampleGrn, 'GRN-001 should appear in Inward Register');
  assert.strictEqual(sampleGrn.supplierName, 'Dahua Technology India Pvt Ltd');
  assert.strictEqual(sampleGrn.quantity, 10);
  assert.strictEqual(sampleGrn.unitRate, 4500);
  assert(sampleGrn.serialNumbers.length === 10, 'GRN-001 should record 10 serial numbers');
  console.log(`  • Verified GRN-001 Inward: 10x ${sampleGrn.productName} @ ₹${sampleGrn.unitRate} from ${sampleGrn.supplierName}`);
  console.log('✓ PASS: Inward register verified with complete procurement and serial audit.\n');

  // TEST 4: Outward Register Validation
  console.log('[Test 4] Testing Outward Register (DCs & Invoices)...');
  const outwardRegister = financeService.getOutwardRegister();
  assert(Array.isArray(outwardRegister) && outwardRegister.length > 0, 'Outward register must contain records');

  const billedRow = outwardRegister.find((r) => r.isBilled && r.dcNumber === 'DC/001/2026');
  assert(billedRow, 'DC/001 should be marked as billed');
  assert.strictEqual(billedRow.invoiceNumber, 'INV/001/2026');
  assert.strictEqual(billedRow.customerName, 'Apex Technologies Pvt Ltd');
  assert.strictEqual(billedRow.unitRate, 11000);

  const unbilledRow = outwardRegister.find((r) => !r.isBilled && r.dcNumber === 'DC/002/2026');
  assert(unbilledRow, 'DC/002 should be marked as unbilled');
  assert.strictEqual(unbilledRow.isBilled, false);
  console.log(`  • Verified Billed Outward:   ${billedRow.dcNumber} -> ${billedRow.invoiceNumber} @ ₹${billedRow.unitRate}`);
  console.log(`  • Verified Unbilled Outward: ${unbilledRow.dcNumber} (Status: UNBILLED) @ ₹${unbilledRow.unitRate}`);
  console.log('✓ PASS: Outward register verified with Billed vs Unbilled status classification.\n');

  // TEST 5: Serial Number Lifecycle & Unit Profitability Tracker
  console.log('[Test 5] Testing Serial Number Lifecycle & Provenance Tracking...');

  // 5A: Billed Serial
  console.log('  5A: Tracing Billed Serial "CAM-IPC-001-SN-1001"...');
  const billedSerial = financeService.getSerialLifecycle('CAM-IPC-001-SN-1001');
  assert.strictEqual(billedSerial.success, true);
  assert.strictEqual(billedSerial.status, 'BILLED_ACTIVE');
  assert.strictEqual(billedSerial.inward.inwardCostPrice, 4500);
  assert.strictEqual(billedSerial.outward.sellingPrice, 11000);
  assert.strictEqual(billedSerial.financials.unitGrossProfit, 6500);
  assert.strictEqual(billedSerial.financials.marginPercent, 59.1);
  assert.strictEqual(billedSerial.financials.markupPercent, 144.4);
  assert.strictEqual(billedSerial.financials.turnaroundDays, 11);
  console.log(`    ✓ Status: ${billedSerial.statusLabel}`);
  console.log(`    ✓ Inward: PO/001/2026 @ ₹${billedSerial.inward.inwardCostPrice} from ${billedSerial.inward.supplierName}`);
  console.log(`    ✓ Outward: DC/001/2026 -> ${billedSerial.outward.invoiceNumber} @ ₹${billedSerial.outward.sellingPrice} to ${billedSerial.outward.customerName}`);
  console.log(`    ✓ Financial Margin: +₹${billedSerial.financials.unitGrossProfit} (+${billedSerial.financials.markupPercent}% Markup / ${billedSerial.financials.marginPercent}% Gross Margin)`);

  // 5B: Unbilled Serial (Delivered on DC without Invoice)
  console.log('  5B: Tracing Unbilled Serial "DH-CAM-EXP-06M"...');
  const unbilledSerial = financeService.getSerialLifecycle('DH-CAM-EXP-06M');
  assert.strictEqual(unbilledSerial.success, true);
  assert.strictEqual(unbilledSerial.status, 'DISPATCHED_UNBILLED');
  assert.strictEqual(unbilledSerial.inward.inwardCostPrice, 4500);
  assert.strictEqual(unbilledSerial.outward.dcNumber, 'DC/002/2026');
  assert.strictEqual(unbilledSerial.outward.isBilled, false);
  console.log(`    ✓ Status: ${unbilledSerial.statusLabel}`);
  console.log(`    ✓ Flagged on Unbilled DC: ${unbilledSerial.outward.dcNumber} for ${unbilledSerial.outward.customerName}`);

  // 5C: Active Warehouse Stock Serial
  console.log('  5C: Tracing In-Stock Serial "CAM-IPC-001-SN-1004"...');
  const stockSerial = financeService.getSerialLifecycle('CAM-IPC-001-SN-1004');
  assert.strictEqual(stockSerial.success, true);
  assert.strictEqual(stockSerial.status, 'IN_STOCK');
  assert.strictEqual(stockSerial.outward, null);
  assert.strictEqual(stockSerial.inward.inwardCostPrice, 4500);
  console.log(`    ✓ Status: ${stockSerial.statusLabel} (Safe in Warehouse Vault)`);

  console.log('✓ PASS: Serial Number Provenance & Unit Profitability audit verified across all lifecycle states.\n');

  console.log('=======================================================');
  console.log(' ALL FINANCE & SERIAL FLOW AUDIT TESTS PASSED (100%)');
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Finance Audit Failed:', err);
  process.exit(1);
});
